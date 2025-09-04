"use client"

import { useState, useEffect } from "react"

export const useMobile = () => {
  const [isMobile, setIsMobile] = useState(false)
  // Add a state to track if the component has mounted
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true) // Set to true after the first render on the client
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768) // Adjust breakpoint as needed
    }

    // Set initial value
    handleResize()

    // Add event listener
    window.addEventListener("resize", handleResize)

    // Clean up event listener
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // On the server, hasMounted is false, so we return the default (false).
  // On the client's first render, hasMounted is also false.
  // After mounting, hasMounted becomes true, and we return the actual isMobile value.
  // This ensures the initial client render matches the server render.
  return hasMounted ? isMobile : false
}