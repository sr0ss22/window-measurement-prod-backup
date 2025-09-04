import type { WindowItem } from "@/types/window-item"

const STORAGE_KEY = "window-measurement-app-data"

// Load windows from localStorage
export function loadWindowsFromStorage(): WindowItem[] | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const savedData = localStorage.getItem(STORAGE_KEY)
    if (!savedData) return null

    const parsedData = JSON.parse(savedData) as WindowItem[]
    return parsedData
  } catch (error) {
    console.error("Error loading data from localStorage:", error)
    return null
  }
}

// Save windows to localStorage
export function saveWindowsToStorage(windows: WindowItem[]): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    // Create a copy of the windows to modify for storage
    const windowsForStorage = windows.map((window) => {
      // Create a deep copy to avoid modifying the original
      const windowCopy = { ...window }

      // Optimize image storage - if image is too large, reduce quality
      if (windowCopy.image && windowCopy.image.length > 500000) {
        // For data URLs, we can reduce quality by converting to canvas and back
        windowCopy.image = reduceImageQuality(windowCopy.image, 0.7)
      }

      // Do the same for wizard image
      if (windowCopy.wizardImage && windowCopy.wizardImage.length > 500000) {
        windowCopy.wizardImage = reduceImageQuality(windowCopy.wizardImage, 0.7)
      }

      return windowCopy
    })

    localStorage.setItem(STORAGE_KEY, JSON.stringify(windowsForStorage))
  } catch (error) {
    console.error("Error saving data to localStorage:", error)

    // If we hit quota, try more aggressive optimization
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      try {
        // Create a more aggressively optimized version
        const windowsForStorage = windows.map((window) => {
          const windowCopy = { ...window }

          // More aggressive image compression
          if (windowCopy.image) {
            windowCopy.image = reduceImageQuality(windowCopy.image, 0.5)
          }

          if (windowCopy.wizardImage) {
            windowCopy.wizardImage = reduceImageQuality(windowCopy.wizardImage, 0.5)
          }

          // If still too large, we might need to remove some data
          if (JSON.stringify(windowCopy).length > 1000000) {
            // Keep essential data but remove large fields
            windowCopy.annotations = null
          }

          return windowCopy
        })

        localStorage.setItem(STORAGE_KEY, JSON.stringify(windowsForStorage))
      } catch (fallbackError) {
        console.error("Failed to save data even with optimization:", fallbackError)
      }
    }
  }
}

// Clear all data from localStorage
export function clearWindowsStorage(): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error("Error clearing data from localStorage:", error)
  }
}

// Add the reduceImageQuality helper function
function reduceImageQuality(dataUrl: string, quality = 0.7): string {
  try {
    // Create an image element
    const img = document.createElement("img")
    img.src = dataUrl

    // Create a canvas to draw the image
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height

    // Draw the image to the canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) return dataUrl

    ctx.drawImage(img, 0, 0)

    // Convert back to data URL with reduced quality
    return canvas.toDataURL("image/jpeg", quality)
  } catch (error) {
    console.error("Error reducing image quality:", error)
    return dataUrl
  }
}
