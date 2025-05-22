const chatWrapper = document.getElementById('chat-wrapper');
const replyBtn = document.getElementById('reply-btn');
const userInput = document.getElementById('user-input');

let currentIndex = 0;

const chatData = [
  { role: 'assistant', text: "Hi! I'm your personalized travel assistant for London. Let me help you plan a unique London walking trip !" },
  { role: 'user', text: "I can just find recommendations on Tripadvisor. What makes this site different?" },
  { role: 'assistant', text: "Most standard travel websites offer general suggestions that don't account for individual interests." },
  { role: 'assistant', text: "Our personalized planning service generates walking tour routes tailored to your specific travel preferences." },
  { role: 'user', text: "How can you guarantee the recommendations will really suit me?" },
  { role: 'assistant', text: "Our platform uses attraction data from the UK Office for National Statistics and the Association of Leading Visitor Attractions." },
  { role: 'assistant', text: "Our platform offer clear filters so you can easily indicate your interests. Just select a few preferences and the system will generate the best route for you." },
  { role: 'assistant', text: "You can also check the sample animation on the right." },
  { role: 'user', text: "Sounds great... but is your data up to date? Also, how do you ensure the route actually saves time?" },
  { role: 'assistant', text: "Our platform uses the latest data, and integrates with Mapbox's real-time walking route optimization. Each route is the most efficient CityWalk path." },
  { role: 'assistant', text: "The route is optimized to include up to 10 locations while minimizing walking time based on your starting point and preferences." },
  { role: 'assistant', text: "If you're not satisfied, you can always modify the types of attractions or reset your starting point." },
  { role: 'user', text: "Sounds pretty good... One last question—does this service cost anything?" },
  { role: 'assistant', text: "This website is completely free to use." },
  { role: 'assistant', text: "Let's get started!" }, 

  { role: 'assistant', text: '<button class="start-btn" onclick="startGuide()">Start Now</button>' }
];

function appendBubble(role, text) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role} visible`;
  bubble.innerHTML = text;
  chatWrapper.appendChild(bubble);
  chatWrapper.scrollTop = chatWrapper.scrollHeight;
}


function showAssistantLine(callback) {
  if (currentIndex < chatData.length && chatData[currentIndex].role === 'assistant') {
    appendBubble('assistant', chatData[currentIndex].text);
    currentIndex++;
    setTimeout(callback, 1000); 
  } else {
    callback();
  }
}


function showAssistantUntilNextUser() {
  if (currentIndex >= chatData.length) return;

  const runNext = () => {
    if (currentIndex < chatData.length && chatData[currentIndex].role === 'assistant') {
      showAssistantLine(runNext);
    } else if (chatData[currentIndex] && chatData[currentIndex].role === 'user') {
      const userText = chatData[currentIndex].text;
      userInput.value = userText;
      userInput.disabled = true; 
      replyBtn.disabled = false;
    }
  };

  runNext();
}


window.addEventListener('load', () => {
  showAssistantLine(() => {
    const userText = chatData[currentIndex].text;
    if (chatData[currentIndex].role === 'user') {
      userInput.value = userText;
      userInput.disabled = true;
      replyBtn.disabled = false;
    }
  });
});


replyBtn.addEventListener('click', () => {
  appendBubble('user', userInput.value);
  currentIndex++; 
  userInput.value = '';
  userInput.disabled = true;
  replyBtn.disabled = true;

  setTimeout(() => {
    showAssistantUntilNextUser();
  }, 600);
});

function startGuide() {
  document.getElementById('guide-section').style.display = 'flex';
  document.getElementById('guide-section').scrollIntoView({ behavior: 'smooth' });
}


  function scrollToTop() {
    document.getElementById('guide-section').style.display = 'none';

    document.getElementById('chat-panel').scrollIntoView({ behavior: 'smooth' });
  }