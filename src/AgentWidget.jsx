import { useState, useRef, useEffect } from 'react'
import './App.css'

// Format message content with markdown support
const formatMessage = (content) => {
  if (!content) return ''
  
  // Replace \n with actual line breaks
  let formatted = content.replace(/\\n/g, '\n')
  
  // Escape HTML to prevent XSS (must be done first)
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Convert **text** to <strong>text</strong> (handle bold first)
  // Use non-greedy matching to handle multiple bold sections
  formatted = formatted.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  
  // Convert remaining single *text* to <em>text</em>
  // This will only match single asterisks that aren't part of **
  formatted = formatted.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
  
  // Split by double newlines (or more) to create paragraphs
  const paragraphs = formatted.split(/\n\s*\n+/)
  
  const formattedParagraphs = paragraphs.map((para) => {
    // Trim whitespace
    para = para.trim()
    if (!para) return ''
    
    // Replace single newlines with <br> within paragraphs
    const lines = para.split('\n')
    const withBreaks = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('<br />')
    
    return withBreaks ? `<p>${withBreaks}</p>` : ''
  }).filter(p => p.length > 0)
  
  // If no paragraphs were created, wrap the whole thing
  if (formattedParagraphs.length === 0) {
    const lines = formatted.split('\n')
    const withBreaks = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('<br />')
    return withBreaks ? `<p>${withBreaks}</p>` : formatted
  }
  
  return formattedParagraphs.join('')
}

// Agent Widget Component
function AgentWidget({ 
  endpoint, 
  accessKey, 
  title, 
  widgetClass,
  isOpen,
  onToggle
}) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! How can I help you today?',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(true)
  const messagesEndRef = useRef(null)

  const formatTimestamp = () => {
    const now = new Date()
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const day = days[now.getDay()]
    const month = months[now.getMonth()]
    const date = now.getDate()
    const year = now.getFullYear()
    let hours = now.getHours()
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${day}, ${month} ${date}, ${year} | ${hours}:${minutes} ${ampm}`
  }

  const clearMessages = () => {
    setMessages([{
      role: 'assistant',
      content: 'Hello! How can I help you today?',
      timestamp: new Date()
    }])
    setShowQuickActions(true)
  }

  const isInProductTour = () => {
    // Check if user actually started Product Tour
    const startedProductTour = messages.some(msg => 
      msg.role === 'user' && 
      msg.content.toLowerCase().includes('product tour')
    )
    
    // If product tour was never started, don't show buttons
    if (!startedProductTour) {
      return false
    }
    
    // Find the last user message to check if we're still in product tour
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user')
    
    // Check if the last user action was product tour related
    // Includes: Product Tour, next, prev, or item number selections (e.g., #6, 6, #1, etc.)
    const isItemNumber = lastUserMessage && /^#?\d+$/.test(lastUserMessage.content.trim())
    const isStillInTour = lastUserMessage && (
      lastUserMessage.content.toLowerCase().includes('product tour') || 
      lastUserMessage.content.toLowerCase() === 'next' ||
      lastUserMessage.content.toLowerCase() === 'prev' ||
      isItemNumber
    )
    
    // Don't show buttons if we've already exited (last message is "How else can I help you?")
    const hasExited = messages.length > 0 && 
      messages[messages.length - 1].role === 'assistant' && 
      messages[messages.length - 1].content === 'How else can I help you?'
    
    // Only show buttons if product tour was started, we're still in it, and haven't exited
    return startedProductTour && isStillInTour && !hasExited
  }

  const isLastAssistantMessage = (index) => {
    // Check if this is the last assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return i === index
      }
    }
    return false
  }

  const getCurrentStepNumber = () => {
    // Find the last assistant message
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant')
    
    if (!lastAssistantMessage) {
      return null
    }
    
    const content = lastAssistantMessage.content
    
    // Try to extract step number from various formats:
    // "Step 5", "step 5", "Step: 5", "step: 5", "Step 5:", "step 5:", etc.
    // Also check for patterns like "Step 5 of 14" or just numbers in context
    const stepPatterns = [
      /step\s*:?\s*(\d+)/i,           // "Step 5" or "Step: 5"
      /step\s+(\d+)/i,                // "Step 5"
      /^step\s*(\d+)/i,               // "Step5" at start
      /\(step\s*(\d+)\)/i,            // "(Step 5)"
      /\[step\s*(\d+)\]/i,            // "[Step 5]"
    ]
    
    for (const pattern of stepPatterns) {
      const match = content.match(pattern)
      if (match && match[1]) {
        const stepNum = parseInt(match[1], 10)
        if (!isNaN(stepNum)) {
          return stepNum
        }
      }
    }
    
    // If no step pattern found, try to find a number that might represent a step
    // Look for standalone numbers that could be step numbers (1-20 range)
    const numberMatch = content.match(/\b([1-9]|1[0-9]|20)\b/)
    if (numberMatch) {
      const num = parseInt(numberMatch[1], 10)
      if (!isNaN(num) && num >= 1 && num <= 20) {
        return num
      }
    }
    
    return null
  }

  const hasClickedNext = () => {
    // Find the most recent "Product Tour" message index
    let lastProductTourIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content.toLowerCase().includes('product tour')) {
        lastProductTourIndex = i
        break
      }
    }
    
    // If no Product Tour found, return false
    if (lastProductTourIndex === -1) {
      return false
    }
    
    // Check if there's navigation after the most recent Product Tour message
    // Navigation includes: "next", "prev", or item number selections (e.g., #6, 6, #1, etc.)
    // but before any "How else can I help you?" exit message
    for (let i = lastProductTourIndex + 1; i < messages.length; i++) {
      // If we hit an exit message, stop checking
      if (messages[i].role === 'assistant' && messages[i].content === 'How else can I help you?') {
        break
      }
      // If we find navigation (next, prev, or item number), return true
      if (messages[i].role === 'user') {
        const content = messages[i].content.toLowerCase().trim()
        if (content === 'next' || content === 'prev' || /^#?\d+$/.test(content)) {
          return true
        }
      }
    }
    
    return false
  }

  const handleNext = () => {
    const userMessage = {
      role: 'user',
      content: 'next'
    }
    setMessages(prev => [...prev, userMessage])
    handleSendMessage('next')
  }

  const handlePrev = () => {
    const userMessage = {
      role: 'user',
      content: 'prev'
    }
    setMessages(prev => [...prev, userMessage])
    handleSendMessage('prev')
  }

  const handleStepSelection = (stepNumber) => {
    const userMessage = {
      role: 'user',
      content: stepNumber.toString()
    }
    setMessages(prev => [...prev, userMessage])
    handleSendMessage(stepNumber.toString())
  }

  const handleExit = () => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'How else can I help you?',
      timestamp: new Date()
    }])
    setShowQuickActions(true)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  const handleQuickAction = (actionText) => {
    setShowQuickActions(false)
    const userMessage = {
      role: 'user',
      content: actionText
    }
    setMessages(prev => [...prev, userMessage])
    handleSendMessage(actionText)
  }

  const handleSendMessage = async (messageText) => {
    setIsLoading(true)

    try {
      const response = await fetch(`${endpoint}/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            ...messages.map(msg => ({ role: msg.role, content: msg.content })),
            {
              role: 'user',
              content: messageText
            }
          ],
          stream: false,
          include_functions_info: false,
          include_retrieval_info: false,
          include_guardrails_info: false
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('API Response:', data)
      
      // Extract the assistant's message from the response
      const assistantMessage = data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t process that request.'
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date()
      }])
    } catch (error) {
      console.error('Error calling agent API:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error connecting to the agent. Please try again.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    setShowQuickActions(false)
    const userMessage = {
      role: 'user',
      content: inputValue
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = inputValue
    setInputValue('')
    await handleSendMessage(currentInput)
  }

  return (
    <div className={`custom-agent-widget ${widgetClass || ''} ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <div className={`agent-window ${isMaximized ? 'maximized' : ''}`}>
          <div className="agent-window-header">
            <h3>{title}</h3>
            <div className="header-actions">
              <button 
                className="header-icon-button"
                onClick={() => setIsMaximized(!isMaximized)}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                  </svg>
                )}
              </button>
              <button 
                className="header-icon-button"
                onClick={onToggle}
                aria-label="Close agent"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          
          <div className="agent-messages">
            <div className="messages-timestamp">{formatTimestamp()}</div>
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                {message.role === 'assistant' && (
                  <div className="message-avatar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path fillRule="evenodd" clipRule="evenodd" d="M7.50009 6C7.50009 3.51472 9.51481 1.5 12.0001 1.5C14.4854 1.5 16.5001 3.51472 16.5001 6C16.5001 8.48528 14.4854 10.5 12.0001 10.5C9.51481 10.5 7.50009 8.48528 7.50009 6Z" fill="#fff"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M3.75133 20.1053C3.82867 15.6156 7.49207 12 12.0001 12C16.5082 12 20.1717 15.6157 20.2488 20.1056C20.254 20.4034 20.0824 20.676 19.8117 20.8002C17.4328 21.8918 14.7866 22.5 12.0004 22.5C9.21395 22.5 6.56752 21.8917 4.18841 20.7999C3.91774 20.6757 3.7462 20.4031 3.75133 20.1053Z" fill="#fff"/>
                    </svg>
                  </div>
                )}
                <div className="message-content">
                  <div 
                    className="message-text"
                    dangerouslySetInnerHTML={{ 
                      __html: message.role === 'assistant' 
                        ? formatMessage(message.content) 
                        : message.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    }}
                  />
                  {message.role === 'user' && (
                    <div className="message-status">
                      <span>Read {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  )}
                  {message.role === 'assistant' && (
                    <div className="message-status">
                      <span>Sent {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  )}
                  {message.role === 'assistant' && isInProductTour() && isLastAssistantMessage(index) && !isLoading && (
                    <>
                      <div className="tour-actions">
                        {(() => {
                          const currentStep = getCurrentStepNumber()
                          const showPrev = hasClickedNext() && (currentStep === null || currentStep > 1)
                          const showNext = currentStep === null || currentStep < 14
                          
                          return (
                            <>
                              {showPrev && (
                                <button 
                                  className="tour-button tour-button-prev"
                                  onClick={handlePrev}
                                  disabled={isLoading}
                                >
                                  Prev
                                </button>
                              )}
                              {showNext && (
                                <button 
                                  className="tour-button tour-button-next"
                                  onClick={handleNext}
                                  disabled={isLoading}
                                >
                                  Next
                                </button>
                              )}
                              <button 
                                className="tour-button tour-button-exit"
                                onClick={handleExit}
                              >
                                Exit
                              </button>
                            </>
                          )
                        })()}
                      </div>
                      {(() => {
                        const currentStep = getCurrentStepNumber()
                        if (currentStep === 14) {
                          return (
                            <div className="step-selection-buttons">
                              {Array.from({ length: 13 }, (_, i) => i + 1).map((stepNum) => (
                                <button
                                  key={stepNum}
                                  className="step-circle-button"
                                  onClick={() => handleStepSelection(stepNum)}
                                  disabled={isLoading}
                                >
                                  {stepNum}
                                </button>
                              ))}
                            </div>
                          )
                        }
                        return null
                      })()}
                    </>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="message-checkmark">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" fill="#4CAF50"/>
                      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M7.50009 6C7.50009 3.51472 9.51481 1.5 12.0001 1.5C14.4854 1.5 16.5001 3.51472 16.5001 6C16.5001 8.48528 14.4854 10.5 12.0001 10.5C9.51481 10.5 7.50009 8.48528 7.50009 6Z" fill="#fff"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.75133 20.1053C3.82867 15.6156 7.49207 12 12.0001 12C16.5082 12 20.1717 15.6157 20.2488 20.1056C20.254 20.4034 20.0824 20.676 19.8117 20.8002C17.4328 21.8918 14.7866 22.5 12.0004 22.5C9.21395 22.5 6.56752 21.8917 4.18841 20.7999C3.91774 20.6757 3.7462 20.4031 3.75133 20.1053Z" fill="#fff"/>
                  </svg>
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
            {showQuickActions && (messages.length === 1 || (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content === 'How else can I help you?')) && (
              <div className="quick-actions">
                <button 
                  className="quick-action-button"
                  onClick={() => handleQuickAction('Product Tour')}
                >
                  Start Product Tour
                </button>
                <button 
                  className="quick-action-button"
                  onClick={() => handleQuickAction('Help with a Task')}
                >
                  Help with a Task
                </button>
                <button 
                  className="quick-action-button"
                  onClick={() => handleQuickAction('Ask a Question')}
                >
                  Ask a Question
                </button>
              </div>
            )}
          </div>

          {messages.length > 1 && (
            <div className="clear-messages-container">
              <button
                type="button"
                className="clear-messages-button"
                onClick={clearMessages}
              >
                Clear Messages
              </button>
            </div>
          )}

          <div className="agent-input-container">
            <form className="agent-input-form" onSubmit={handleSend}>
              <input
                type="text"
                className="agent-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="submit"
                className="send-button"
                disabled={!inputValue.trim() || isLoading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
      
      <button 
        className="agent-toggle-button"
        onClick={onToggle}
        aria-label={isOpen ? 'Close agent' : 'Open agent'}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M7.50009 6C7.50009 3.51472 9.51481 1.5 12.0001 1.5C14.4854 1.5 16.5001 3.51472 16.5001 6C16.5001 8.48528 14.4854 10.5 12.0001 10.5C9.51481 10.5 7.50009 8.48528 7.50009 6Z" fill="#fff"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M3.75133 20.1053C3.82867 15.6156 7.49207 12 12.0001 12C16.5082 12 20.1717 15.6157 20.2488 20.1056C20.254 20.4034 20.0824 20.676 19.8117 20.8002C17.4328 21.8918 14.7866 22.5 12.0004 22.5C9.21395 22.5 6.56752 21.8917 4.18841 20.7999C3.91774 20.6757 3.7462 20.4031 3.75133 20.1053Z" fill="#fff"/>
          </svg>
        )}
      </button>
    </div>
  )
}

export default AgentWidget
