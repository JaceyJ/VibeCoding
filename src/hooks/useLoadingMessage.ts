import { useState, useEffect, useRef } from 'react';

const LOADING_MESSAGES = [
  "Don't panic! Your trip is almost here!",
  "Plotting the perfect route...",
  "Finding the best stops along the way...",
  "Calculating optimal paths...",
  "Almost there! Just a few more seconds...",
  "Working our magic behind the scenes...",
  "Your adventure is being crafted...",
  "Good things come to those who wait...",
  "Assembling your perfect journey...",
  "We're putting the pieces together...",
  "Just a moment while we work our wizardry...",
  "Creating something special for you...",
  "Hang tight! Great routes take time...",
  "We're making sure everything is perfect...",
  "Your trip is taking shape...",
  "Almost ready to hit the road...",
  "Fine-tuning your route details...",
  "Preparing an amazing journey for you..."
];

const MESSAGE_ROTATION_INTERVAL = 10000; // 10 seconds

/**
 * Custom hook that rotates through loading messages
 * @param isActive - Whether the loading state is active
 * @returns Current loading message
 */
export function useLoadingMessage(isActive: boolean): string {
  const [currentIndex, setCurrentIndex] = useState(0);
  const shuffledMessagesRef = useRef<string[]>(LOADING_MESSAGES);

  useEffect(() => {
    if (!isActive) {
      setCurrentIndex(0);
      return;
    }

    // Shuffle messages when loading starts for variety
    shuffledMessagesRef.current = [...LOADING_MESSAGES].sort(() => Math.random() - 0.5);
    setCurrentIndex(0);

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        // Cycle through messages
        return (prevIndex + 1) % shuffledMessagesRef.current.length;
      });
    }, MESSAGE_ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [isActive]);

  return shuffledMessagesRef.current[currentIndex];
}

