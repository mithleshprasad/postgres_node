document.addEventListener('DOMContentLoaded', loadHistory);
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') sendMessage();
});

async function loadHistory() {
  try {
    const response = await fetch('/history');
    if (!response.ok) throw new Error('Failed to fetch history');
    const history = await response.json();
    history.forEach(msg => {
      const className = msg.role === 'user' ? 'user-msg' : 'ai-msg';
      appendMessage(msg.content, className);
    });
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

async function sendMessage() {
  const inputEl = document.getElementById('user-input');
  const message = inputEl.value.trim();
  
  if (!message) return;
  
  appendMessage(message, 'user-msg');
  inputEl.value = '';
  
  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    
    if (!response.body) throw new Error('No readable stream');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiMessage = '';
    
    // Create an empty element for the AI response
    const aiMessageEl = document.createElement('div');
    aiMessageEl.className = 'message ai-msg';
    document.getElementById('chat-box').appendChild(aiMessageEl);
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      aiMessage += chunk;
      aiMessageEl.textContent = aiMessage;
      
      // Auto-scroll
      const chatBox = document.getElementById('chat-box');
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  } catch (err) {
    console.error('Error during chat:', err);
    appendMessage('Error: Could not reach the server.', 'ai-msg');
  }
}

function appendMessage(text, className) {
  const chatBox = document.getElementById('chat-box');
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${className}`;
  msgDiv.textContent = text;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}
