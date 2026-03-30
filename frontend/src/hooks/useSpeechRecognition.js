import { useState, useEffect, useRef, useCallback } from 'react'

export const useSpeechRecognition = () => {
  const [transcript,        setTranscript]        = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isListening,       setIsListening]       = useState(false)
  const [error,             setError]             = useState(null)
  const recognitionRef = useRef(null)
  const isListeningRef = useRef(false)

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.msSpeechRecognition

    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Try Edge or Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous      = true
    recognition.interimResults  = true
    recognition.lang            = 'en-US'
    recognition.maxAlternatives = 3
    recognition.interimResults  = true

    recognition.onresult = (event) => {
  let final  = ''
  let interim = ''
  for (let i = event.resultIndex; i < event.results.length; i++) {
    if (event.results[i].isFinal) {
      // Pick highest confidence alternative
      let best = event.results[i][0]
      for (let j = 1; j < event.results[i].length; j++) {
        if (event.results[i][j].confidence > best.confidence) {
          best = event.results[i][j]
        }
      }
      final += best.transcript + ' '
    } else {
      interim += event.results[i][0].transcript
    }
  }
  if (final) setTranscript(prev => prev + final)
  setInterimTranscript(interim)
}

    recognition.onerror = (event) => {
  if (event.error === 'no-speech') {
    // Don't treat as fatal — just restart listening
    logger.info && console.log('No speech detected, restarting...')
    try {
      recognitionRef.current.stop()
      setTimeout(() => {
        if (isListeningRef.current) {
          recognitionRef.current.start()
        }
      }, 300)
    } catch(e) {}
    return  // don't set error state
  }

  console.error('STT error:', event.error)
  setError(event.error)
  setIsListening(false)
  isListeningRef.current = false
}

    recognitionRef.current = recognition
  }, [])

  const startListening = useCallback(async () => {
  if (!recognitionRef.current) return
  if (isListeningRef.current) return  // already running, do nothing

  // Request mic permission explicitly
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(t => t.stop())
  } catch (err) {
    setError(`Microphone access denied: ${err.message}`)
    return
  }

  setTranscript('')
  setInterimTranscript('')
  setError(null)

  try {
    recognitionRef.current.start()
    setIsListening(true)
    isListeningRef.current = true
    console.log('STT started successfully')
  } catch (err) {
    if (err.name === 'InvalidStateError') {
      // Already running — just update state to reflect that
      setIsListening(true)
      isListeningRef.current = true
      console.log('STT was already running')
    } else {
      console.error('Recognition start error:', err)
      setError(err.message)
    }
  }
}, [])

  const stopListening = useCallback(() => {
  if (!recognitionRef.current || !isListeningRef.current) return
  
  try {
    recognitionRef.current.stop()
    recognitionRef.current.abort()  // force release the mic
  } catch(e) {}
  
  setIsListening(false)
  isListeningRef.current = false
}, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  return {
    transcript,
    interimTranscript,
    isListening,
    error,
    startListening,
    stopListening,
    resetTranscript
  }
}