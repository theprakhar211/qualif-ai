import { useState, useEffect, useCallback, useRef } from 'react'

export const useSpeechSynthesis = () => {
  const [isSpeaking,    setIsSpeaking]    = useState(false)
  const [voices,        setVoices]        = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)
  const utteranceRef = useRef(null)
  const speakingRef  = useRef(false)

  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices()
      setVoices(available)

      const preferred =
        available.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
        available.find(v => v.name.includes('Google')    && v.lang.startsWith('en')) ||
        available.find(v => v.lang.startsWith('en')) ||
        available[0]

      setSelectedVoice(preferred)
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    speakingRef.current = false
    setIsSpeaking(false)
  }, [])

  const speak = useCallback((text, onEnd) => {
    if (!text) return

    // Prevent duplicate calls
    if (speakingRef.current) {
      window.speechSynthesis.cancel()
      speakingRef.current = false
    }

    // Cancel then wait longer for Edge to fully reset
    window.speechSynthesis.cancel()

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text)

      if (selectedVoice) utterance.voice = selectedVoice
      utterance.rate   = 0.9
      utterance.pitch  = 1.0
      utterance.volume = 1.0

      utterance.onstart = () => {
        speakingRef.current = true
        setIsSpeaking(true)
      }

      utterance.onend = () => {
        speakingRef.current = false
        setIsSpeaking(false)
        if (onEnd) onEnd()
      }

      utterance.onerror = (e) => {
        // 'interrupted' is not a real error — it means cancel() was called
        if (e.error === 'interrupted') return
        console.error('TTS error:', e.error)
        speakingRef.current = false
        setIsSpeaking(false)
        if (onEnd) onEnd()
      }

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    }, 300)  // 300ms gives Edge enough time to fully reset after cancel()

  }, [selectedVoice])

  return { speak, stop, isSpeaking, voices, selectedVoice }
}