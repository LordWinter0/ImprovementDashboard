// script.js

const TOTAL_CHALLENGE_DAYS = 90;
const TOKEN_FOR_DAILY_FOCUS_COMPLETION = 3; // Tokens gained per daily focus completion
const MAX_DAILY_SKILL_TASKS = 3; // Max number of daily skill tasks to present

// --- Utility Functions ---
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTimeUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Set to next midnight
    return midnight.getTime() - now.getTime();
}

let countdownInterval;
function startCountdownTimer() {
    const timerElement = document.getElementById('countdown-timer');
    if (timerElement && countdownInterval) clearInterval(countdownInterval);

    if (!timerElement) {
        console.warn("Countdown timer element not found.");
        return;
    }

    countdownInterval = setInterval(() => {
        const timeLeft = getTimeUntilMidnight();
        if (timeLeft <= 0) {
            timerElement.textContent = 'Refreshing now...';
            clearInterval(countdownInterval);
            location.reload();
        } else {
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            timerElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

const AppState = {
    currentView: 'dashboard',
    userName: null,
    difficulty: 'normal',
    selectedSkills: new Set(),
    isPersonalized: false,
    today: 1,
    completedDays: new Set(),
    currentStreak: 0,
    bestStreak: 0,
    dailyActivityMap: {}, // Stores main, focus, mood, highlight, missedReason for each day
    completedSkillTasks: {}, // { skillId: [taskIndex, ...], ... }
    completedPillarTasks: {}, // { pillarId: [taskIndex, ...], ... }
    tokens: 0,
    dailyFocusTasks: [], // [{ skillId, taskIndex, taskText, completed }, ...]
    dailyFocusCompletedToday: false,
    lastDailyFocusDate: null,
    nextDailyFocusBonus: 0,
    restDaysAvailable: 0,
    userGoals: {}, // { entityId: [{ id, text, completed }, ...], global: [...] }
    globalGoals: [],
    earnedBadges: new Set(),
    purchasedShopItems: new Set(),
    lastSummaryDate: null, // For future potential weekly/monthly summaries
    startDate: null, // Date challenge officially started
    lastVisitDate: null, // Last date user opened the app
    affirmations: [
        "Believe you can and you're halfway there. ✨",
        "Every step forward, no matter how small, counts. Keep going! 💪",
        "Your glow-up is a journey, not a destination. Enjoy the ride! 🌈",
        "Consistency beats intensity. Little by little, a little becomes a lot. 🌟",
        "You are stronger than you think. Unleash your inner awesome! 🔥",
        "Today is another chance to get it right. Make it count! ✅",
        "The only way to do great work is to love what you do. ❤️",
        "Don't wish for it, work for it. You've got this! 💪",
        "Small daily improvements are the key to staggering long-term results. 📈",
        "Your mindset is everything. Think positive, be positive! 😊"
    ],
    userAffirmations: [], // Custom affirmations added by user
    journalEntries: [], // [{ id, date, mood, highlight, content, tags }]
    theme: 'light',
    customThemeColors: null, // { --bg-primary: '#...', ... }
    notificationsEnabled: true,
    reduceMotion: false,
    customPillars: [], // [{ id, icon, title, content, tasks }]
    customSkills: [], // [{ id, icon, title, content, tasks }]
};

const dailyTasks = Array.from({ length: TOTAL_CHALLENGE_DAYS }, (_, i) => {
    const day = i + 1;
    let pillar, task;

    if (day <= 30) {
        switch (day % 10) {
            case 1: pillar = 'Mind'; task = "Goal Setting & Hydration: Write down your goals. Track water intake."; break;
            case 2: pillar = 'Skin'; task = "Simple Cleansing: Gentle face wash morning and night."; break;
            case 3: pillar = 'Body'; task = "Mindful Movement: 20-minute walk or in-place exercise."; break;
            case 4: pillar = 'Mind'; task = "Study Space Overhaul: Organize your desk and study area."; break;
            case 5: pillar = 'Nourish'; task = "Fruit Focus: Try a new fruit as a snack."; break;
            case 6: pillar = 'Nourish'; task = "Healthy Swap: Swap one sugary drink for water."; break;
            case 7: pillar = 'Mind'; task = "Reflection & Relaxation: Review your week. Listen to music or read."; break;
            case 8: pillar = 'Body'; task = "Workout Fun: 15-minute dance workout."; break;
            case 9: pillar = 'Mind'; task = "New Skill Mini-Lesson: Watch a short tutorial on something new (e.g., drawing, simple coding)."; break;
            case 0: pillar = 'Body'; task = "Strength Starter: 2 sets of 10 squats, 20-second plank."; break;
            default: pillar = 'Mind'; task = "Daily check-in: How are you feeling today?"; break;
        }
        // Specific tasks for certain days in phase 1
        if (day === 11) { pillar = 'Hygiene'; task = "Hygiene Refresh: Clean toothbrush. Wear fresh clothes."; }
        if (day === 12) { pillar = 'Style'; task = "Style Fun: Try a new, simple hairstyle."; }
        if (day === 13) { pillar = 'Nourish'; task = "Snack Smart: Choose fruit over chips/candy."; }
        if (day === 14) { pillar = 'Mind'; task = "Mid-Point Check-in: Notice any changes? Pat yourself on the back!"; }
        if (day === 15) { pillar = 'Nourish'; task = "Breakfast Boost: Start with a banana or fruit."; }
        if (day === 16) { pillar = 'Mind'; task = "Brain Boost: 20 minutes reading for fun."; }
        if (day === 17) { pillar = 'Body'; task = "Cardio Challenge: 3 sets of 30 jumping jacks."; }
        if (day === 18) { pillar = 'Style'; task = "Closet Cleanse: Organize favorite outfits."; }
        if (day === 19) { pillar = 'Mind'; task = "Gratitude Practice: Think of one good thing today."; }
        if (day === 20) { pillar = 'Skin'; task = "Self-Care Simple: Relaxing bath/shower, gentle skin scrub."; }
        if (day === 21) { pillar = 'Body'; task = "Outdoor Time: 15 minutes outside (not midday sun)."; }
        if (day === 22) { pillar = 'Nourish'; task = "Kitchen Helper: Help with family meal prep."; }
        if (day === 23) { pillar = 'Mind'; task = "Focus Power: Try Pomodoro Technique for homework."; }
        if (day === 24) { pillar = 'Body'; task = "Full-Body Flow: 20-min routine: jumping jacks, squats, push-ups, plank."; }
        if (day === 25) { pillar = 'Hygiene'; task = "Scent-sational Self-Care: Daily deodorant. Baby powder for freshness."; }
        if (day === 26) { pillar = 'Style'; task = "Outfit of the Day: Pick your favorite clean outfit, wear with confidence."; }
        if (day === 27) { pillar = 'Mind'; task = "Mindful Morning: 5 minutes quiet stretching."; }
        if (day === 28) { pillar = 'Mind'; task = "Knowledge is Power: Watch an interesting educational video."; }
        if (day === 29) { pillar = 'Style'; task = "Confidence Boost: Stand straight, shoulders back, smile in mirror."; }
        if (day === 30) { pillar = 'Mind'; task = "Celebrate You! Look back at Day 1. Be proud of your consistency!"; }
    } else if (day <= 60) {
        switch (day % 10) {
            case 1: pillar = 'Nourish'; task = "Balanced Meal: Include a protein, veggie, and carb in one meal."; break;
            case 2: pillar = 'Body'; task = "Core Strength: Try 3 sets of 15 crunches."; break;
            case 3: pillar = 'Skin'; task = "Exfoliation Intro: Gently exfoliate face (once this week)."; break;
            case 4: pillar = 'Hygiene'; task = "Oral Care: Add mouthwash to your routine."; break;
            case 5: pillar = 'Mind'; task = "Journaling: Write 3 things you're grateful for."; break;
            case 6: pillar = 'Style'; task = "Color Pop: Wear an item with a color you love."; break;
            case 7: pillar = 'Nourish'; task = "Hydration Challenge: Drink an extra glass of water."; break;
            case 8: pillar = 'Body'; task = "Active Chores: Help with active chores like sweeping or gardening for 20 min."; break;
            case 9: pillar = 'Mind'; task = "New Skill Mini-Lesson: Watch a short tutorial on something new (e.g., drawing, simple coding)."; break;
            case 0: pillar = 'Skin'; task = "Moisturize! Apply moisturizer after washing your face."; break;
            default: pillar = 'Mind'; task = "Discover a new educational podcast or channel."; break;
        }
        if (day === 35) { pillar = 'Mind'; task = "Mindful Breathing: Practice 5 minutes of deep breathing exercises."; }
        if (day === 45) { pillar = 'Body'; task = "Flexibility Focus: Spend 10 minutes stretching your major muscle groups."; }
        if (day === 50) { pillar = 'Nourish'; task = "Healthy Snack Prep: Prepare some healthy snacks for the next few days."; }
        if (day === 55) { pillar = 'Style'; task = "Accessories Experiment: Try adding a simple accessory like a watch or a bracelet."; }
        if (day === 59) { pillar = 'Mind'; task = "Future Planning: Jot down some ideas for after the 90-day challenge."; }
        if (day === 60) { pillar = 'Mind'; task = "60-Day Review: Reflect on progress, celebrate consistency. You're doing great!"; }

    } else {
        switch (day % 10) {
            case 1: pillar = 'Nourish'; task = "Cook a Simple Dish: Help prepare a main dish for your family."; break;
            case 2: pillar = 'Body'; task = "Incorporate Stairs: Take the stairs instead of the elevator/escalator today."; break;
            case 3: pillar = 'Skin'; task = "Sun Protection Awareness: Learn about SPF and why it's important."; break;
            case 4: pillar = 'Hygiene'; task = "Laundry Day: Help with laundry, especially your own clothes."; break;
            case 5: pillar = 'Mind'; task = "Digital Detox: Spend 1 hour away from screens before bed."; break;
            case 6: pillar = 'Style'; task = "Outfit Planning: Plan outfits for the entire week ahead."; break;
            case 7: pillar = 'Body'; task = "Interval Training: Try short bursts of high-intensity activity during your walk."; break;
            case 8: pillar = 'Nourish'; task = "Smoothie Experiment: Create your own healthy smoothie recipe."; break;
            case 9: pillar = 'Mind'; task = "Problem Solving: Tackle a challenging puzzle or brain teaser."; break;
            case 0: pillar = 'Hygiene'; task = "Clean Your Space: Dedicate 30 minutes to tidying your room."; break;
            default: pillar = 'Mind'; task = "Read an article or watch a documentary on a topic you're curious about."; break;
        }
        if (day === 75) { pillar = 'Mind'; task = "Goal Refinement: Revisit your initial goals. How have they evolved?"; }
        if (day === 80) { pillar = 'Body'; task = "Challenge Yourself: Try a longer workout or a new physical activity."; }
        if (day === 85) { pillar = 'Skin'; task = "Identify Skin Type: Do a simple test to understand your skin type (oily, dry, combo)."; }
        if (day === 89) { pillar = 'Mind'; task = "Vision Board: Create a small vision board for your future self."; }
        if (day === 90) { pillar = 'Mind'; task = "Final Celebration! You've completed 90 days! Acknowledge your incredible transformation and plan for continued growth!"; }
    }
    return { day, pillar, task };
});

const defaultPillarsData = [
    {
        id: 'nourish', icon: '🍎', title: 'Nourish Your Body', content: "Fuel your body for energy and health. Focus on fruits (2-3 servings daily), 'hidden' veggies in dishes like lumpia or spaghetti sauce, and drink 6-8 glasses of water. A smoothie with banana and malunggay is a great nutrient boost.",
        tasks: [
            "Drink 8 glasses of water today.",
            "Eat at least 2 servings of fruit.",
            "Include a vegetable in your lunch and dinner.",
            "Try a new healthy vegetable or fruit you haven't eaten before.",
            "Swap one sugary drink for water or unsweetened tea.",
            "Help prepare a healthy meal for your family.",
            "Identify one 'hidden' vegetable you can add to a common dish.",
            "Plan your snacks for tomorrow to be healthy options.",
            "Avoid processed snacks for one day.",
            "Read food labels to identify added sugars in one item."
        ]
    },
    {
        id: 'body', icon: '💪', title: 'Move Your Body', content: "Get stronger and boost your mood without a gym. Aim for 30 minutes of movement 5 days a week. Combine 15-20 mins of cardio (dancing, jumping jacks) with 10-15 mins of strength (squats, planks, push-ups).",
        tasks: [
            "Go for a 20-minute brisk walk.",
            "Do 3 sets of 10 squats.",
            "Hold a plank for 30 seconds (or accumulate 30 seconds with breaks).",
            "Do 3 sets of 15 jumping jacks.",
            "Try a 15-minute dance workout from YouTube.",
            "Help with an active chore for 20 minutes (e.g., sweeping, gardening).",
            "Stretch for 10 minutes before or after your movement session.",
            "Take the stairs instead of an elevator/escalator today.",
            "Do 3 sets of 5 push-ups (on knees if needed).",
            "Explore a new type of home exercise (e.g., yoga, calisthenics)."
        ]
    },
    {
        id: 'skin', icon: '✨', title: 'Radiant Skin', content: "Achieve clean, healthy skin with a simple routine. Your #1 priority is cleansing your face gently with mild soap and water every morning and night. For sun protection, seek shade, wear a cap, or use an umbrella, especially from 10 AM to 4 PM.",
        tasks: [
            "Wash your face gently morning and night.",
            "Apply a simple moisturizer after washing your face.",
            "Drink an extra glass of water to support skin hydration.",
            "Wear a cap or use an umbrella when outside in the sun.",
            "Avoid touching your face unnecessarily throughout the day.",
            "Gently pat your face dry instead of rubbing after washing.",
            "Identify your skin type (e.g., oily, dry, combination) with a simple observation.",
            "Change your pillowcase today for cleaner sleep.",
            "Learn about the importance of SPF (Sun Protection Factor).",
            "Ensure you're removing all makeup before bed."
        ]
    },
    {
        id: 'hygiene', icon: '💧', title: 'Impeccable Hygiene', content: "Feel and smell fresh all day. Key habits include daily showers (especially after exercise), brushing your teeth twice a day, using deodorant every morning, and wearing completely fresh, clean clothes every day.",
        tasks: [
            "Take a refreshing shower/bath today.",
            "Brush your teeth for 2 minutes, twice today.",
            "Apply deodorant/antiperspirant in the morning.",
            "Wear clean, fresh clothes today.",
            "Floss your teeth once today.",
            "Clean your toothbrush and its holder.",
            "Use mouthwash after brushing your teeth.",
            "Trim your nails if needed.",
            "Help with laundry, focusing on your own clothes.",
            "Ensure your shoes are clean and odor-free."
        ]
    },
    {
        id: 'mind', icon: '🧠', title: 'Sharpen Your Mind', content: "Make learning more effective. Keep a dedicated, organized study space. Use the Pomodoro Technique (25 mins focus, 5 mins break) to avoid burnout. Review your notes for 15 minutes each evening to retain information.",
        tasks: [
            "Organize your study space for 15 minutes.",
            "Use the Pomodoro Technique (25 min focus, 5 min break) for a study session.",
            "Spend 15 minutes reviewing notes from a challenging subject.",
            "Read a non-fiction article or a chapter from a book for 20 minutes.",
            "Practice mindfulness with 5 minutes of deep breathing.",
            "Write down 3 things you are grateful for today.",
            "Watch an educational video or documentary for 30 minutes.",
            "Solve a challenging puzzle or brain teaser.",
            "Learn 5 new words and their meanings.",
            "Reflect on your day for 10 minutes before bed."
        ]
    },
    {
        id: 'style', icon: '👕', title: 'Cultivate Your Style', content: "Express yourself and feel confident. Use Pinterest for inspiration. Master the basics like well-fitting jeans and clean t-shirts. A simple outfit looks great with neat hair and good posture. Pick out your clothes the night before.",
        tasks: [
            "Choose an outfit for tomorrow tonight.",
            "Ensure your hair is neat and styled.",
            "Practice good posture for 5 minutes in front of a mirror.",
            "Iron or steam one of your favorite shirts.",
            "Identify 3 items in your wardrobe that fit well.",
            "Create a small mood board (digital or physical) of styles you like.",
            "Learn a new, simple hairstyle or way to tie a scarf.",
            "Accessorize your outfit with one simple item (e.g., watch, simple necklace).",
            "Organize a small section of your closet.",
            "Take a photo of an outfit you feel confident in."
        ]
    }
];

const defaultSkillsData = [
    {
        id: 'coding', icon: '💻', title: 'Coding & Digital', content: 'Learn the fundamentals of coding and digital literacy. Start with visual programming and gradually move to text-based languages.', tasks: [
            "Complete a 'Hello World' tutorial in Scratch or Python.",
            "Learn and use 3 basic HTML tags (e.g., `p`, `h1`, `a`).",
            "Understand how to save and open a simple text file on your computer.",
            "Practice basic touch typing for 15 minutes using an online tool.",
            "Watch a short (10-15 min) video on internet safety and privacy.",
            "Attempt a simple coding challenge, like making a variable count to 10.",
            "Create a very basic webpage with your name and favorite color.",
            "Learn about common keyboard shortcuts for copying, pasting, and undoing.",
            "Explore a coding game or puzzle website (e.g., Code.org, Lightbot) for 20 minutes.",
            "Understand what an algorithm is with a real-world example (e.g., making a sandwich).",
            "Identify the main components of a computer (e.g., CPU, RAM, storage).",
            "Learn to use a simple online calculator for basic operations.",
            "Explore how to safely download and install a free program.",
            "Understand what a 'browser' is and how it works.",
            "Set up a simple online account with a strong password."
        ]
    },
    {
        id: 'creative-arts', icon: '🎨', title: 'Creative Arts', content: 'Unleash your creativity through various artistic expressions. No prior experience needed!', tasks: [
            "Draw 5 simple shapes from observation (e.g., a cup, a book, a phone).",
            "Listen actively to a new music genre for 15 minutes, noting instruments or feelings.",
            "Write a short paragraph (5-7 sentences) describing your favorite place or a recent dream.",
            "Experiment with drawing using only circles and squares to create an object.",
            "Learn 3 basic chords on a guitar, ukulele, or keyboard (if available).",
            "Try a simple origami fold from an online tutorial, aiming for neatness.",
            "Sketch a self-portrait (it doesn't have to be perfect, just practice!).",
            "Create a small collage using old magazines, newspapers, or printed images.",
            "Listen to a piece of classical music and try to identify at least two different instruments.",
            "Write a short, rhyming poem (4-6 lines) about nature or your daily routine.",
            "Try a simple drawing prompt from an online generator (e.g., 'a smiling cloud').",
            "Hum or sing a simple melody you just made up.",
            "Describe a piece of art or music to a friend or family member.",
            "Find an interesting pattern in your surroundings and sketch it.",
            "Learn about a famous artist or musician you admire."
        ]
    },
    {
        id: 'singing', icon: '🎤', title: 'Singing', content: 'Develop your vocal abilities and confidence. Learn basic techniques and practice regularly.', tasks: [
            "Practice a simple vocal warm-up for 5 minutes.",
            "Sing along to your favorite song, focusing on rhythm.",
            "Try to match the pitch of a simple note played on an instrument or app.",
            "Record yourself singing a short phrase and listen back.",
            "Learn about proper breathing techniques for singing.",
            "Sing a simple scale (do-re-mi) a few times.",
            "Listen to a song and try to identify the lead melody.",
            "Sing a lullaby or a nursery rhyme.",
            "Experiment with singing in different vocal tones (e.g., softer, louder).",
            "Watch a short online tutorial on basic singing posture."
        ]
    },
    {
        id: 'songwriting', icon: '✍️🎶', title: 'Songwriting', content: 'Explore expressing your thoughts and feelings through lyrics and melodies.', tasks: [
            "Write down 5 emotions you felt today.",
            "Brainstorm 10 rhyming words for 'moon'.",
            "Write a short, descriptive paragraph about a place you love.",
            "Try to create a simple 4-line poem about an everyday object.",
            "Listen to a song and identify its main theme.",
            "Think of a simple story you could tell in a song.",
            "Hum a simple, new melody for 30 seconds.",
            "Combine two unrelated words to spark a creative idea (e.g., 'tree' + 'ocean').",
            "Write down 3 lines that could be the start of a song chorus.",
            "Experiment with different tempos for a simple melody (faster, slower)."
        ]
    },
    {
        id: 'writing', icon: '📝', title: 'Writing (General)', content: 'Improve your communication and storytelling skills through various forms of writing.', tasks: [
            "Write a journal entry about your day (at least 100 words).",
            "Practice writing a descriptive paragraph about your favorite food.",
            "Write a short thank-you note to someone.",
            "Summarize a short article or video in 3-5 sentences.",
            "Brainstorm 10 ideas for a short story.",
            "Write a review of a movie or book you recently experienced.",
            "Experiment with different opening sentences for a story.",
            "Write a letter to your future self.",
            "Practice using more vivid adjectives in your writing.",
            "Read a short story or poem and identify its main message."
        ]
    },
    {
        id: 'photography', icon: '📸', title: 'Photography', content: 'Learn to capture beautiful moments and tell stories with your camera (even a phone camera!).', tasks: [
            "Take 5 photos of everyday objects from different angles.",
            "Learn about the 'rule of thirds' in photography.",
            "Take a photo focusing on natural light (e.g., sunlight through a window).",
            "Experiment with taking close-up photos (macro photography).",
            "Take a photo of a landscape or an interesting outdoor scene.",
            "Learn about leading lines in composition.",
            "Take a portrait of a friend or family member (with their permission).",
            "Experiment with taking photos during 'golden hour' (sunrise/sunset).",
            "Learn about positive and negative space in a photograph.",
            "Take a photo that tells a small story without words."
        ]
    },
    {
        id: 'public-speaking', icon: '🗣️', title: 'Public Speaking', content: 'Build confidence and clarity in expressing your thoughts to an audience.', tasks: [
            "Practice speaking clearly for 2 minutes about your favorite hobby.",
            "Record yourself talking and listen back to identify areas for improvement.",
            "Practice making eye contact with yourself in a mirror while speaking.",
            "Learn 3 tips for reducing public speaking anxiety.",
            "Deliver a short, prepared speech to a family member.",
            "Practice vocal exercises to improve articulation.",
            "Observe a confident speaker and note their mannerisms.",
            "Try to explain a complex topic in simple terms to someone else.",
            "Learn about the importance of pauses in speaking.",
            "Practice deep breathing exercises before speaking."
        ]
    },
    {
        id: 'leadership', icon: '🤝', title: 'Leadership', content: 'Develop skills to guide, inspire, and motivate others effectively.', tasks: [
            "Identify a task and take initiative to complete it without being asked.",
            "Offer to help a friend or family member with a task they're struggling with.",
            "Practice active listening when someone is speaking to you.",
            "Learn about the qualities of a good leader (e.g., empathy, decisiveness).",
            "Help organize a small group activity or game.",
            "Encourage someone else in their efforts or achievements.",
            "Take responsibility for a mistake you made.",
            "Practice giving clear and concise instructions.",
            "Learn about the importance of teamwork.",
            "Identify a problem in your environment and brainstorm solutions."
        ]
    },
    {
        id: 'problem-solving', icon: '🤔', title: 'Problem Solving', content: 'Enhance your ability to analyze situations and find effective solutions.', tasks: [
            "Identify a small problem you face today and brainstorm 3 solutions.",
            "Solve a logic puzzle or riddle.",
            "Break down a complex task into smaller, manageable steps.",
            "Learn about the '5 Whys' technique for root cause analysis.",
            "Think of an alternative use for an everyday object.",
            "Analyze a scenario from a book or movie and suggest better outcomes.",
            "Practice creative thinking by connecting two unrelated ideas.",
            "When faced with a challenge, list its pros and cons.",
            "Seek out a new perspective on a familiar issue.",
            "Play a strategy game (e.g., chess, checkers) and analyze your moves."
        ]
    },
    {
        id: 'critical-thinking', icon: '🧐', title: 'Critical Thinking', content: 'Develop skills to evaluate information, form reasoned judgments, and make informed decisions.', tasks: [
            "Read a news headline and think of 2 questions to ask about it.",
            "Identify the main argument in a short article or debate.",
            "Learn about the difference between fact and opinion.",
            "When presented with information, ask 'Why?' or 'How do I know this is true?'.",
            "Evaluate a product advertisement: what are they trying to convince you of?",
            "Consider a decision you made today: what factors influenced it?",
            "Practice identifying biases in statements or media.",
            "Discuss a complex topic with someone who has a different viewpoint.",
            "Learn about logical fallacies (e.g., ad hominem, straw man) briefly.",
            "Formulate your own reasoned opinion on a simple topic."
        ]
    },
    {
        id: 'emotional-intelligence', icon: '❤️‍🩹', title: 'Emotional Intelligence', content: 'Understand and manage your own emotions, and recognize and influence the emotions of others.', tasks: [
            "Identify 3 emotions you felt today and why you felt them.",
            "Practice active listening when a friend is sharing a problem.",
            "Learn about body language cues (e.g., crossed arms, smiling).",
            "Try to understand someone else's perspective on a disagreement.",
            "Practice expressing your feelings clearly and respectfully.",
            "Identify a trigger for a strong emotion you feel (e.g., frustration).",
            "Learn about empathy and how it helps relationships.",
            "Offer genuine encouragement to someone who needs it.",
            "Reflect on how your mood affects your actions.",
            "Learn a simple technique for calming yourself when stressed (e.g., deep breaths)."
        ]
    },
    {
        id: 'cooking-baking', icon: '🍳', title: 'Cooking & Baking', content: 'Develop culinary skills to prepare delicious and healthy meals and treats.', tasks: [
            "Safely chop an onion (with adult supervision).",
            "Make a simple sandwich from scratch.",
            "Learn to boil water and cook pasta correctly.",
            "Bake simple cookies following a recipe exactly.",
            "Identify 5 common kitchen utensils and their uses.",
            "Help prepare one component of a family meal (e.g., chop veggies).",
            "Learn about food safety basics (e.g., washing hands).",
            "Make a simple salad with at least 3 ingredients.",
            "Learn how to measure dry and liquid ingredients accurately.",
            "Experiment with a simple spice or herb in a dish."
        ]
    },
    {
        id: 'gardening', icon: '🌱', title: 'Gardening', content: 'Cultivate a green thumb and learn about plant care and growth.', tasks: [
            "Water a plant and observe how the water is absorbed.",
            "Identify 3 common plants or trees in your neighborhood.",
            "Learn about the basic needs of a plant (sunlight, water, soil).",
            "Help plant a seed or a small plant.",
            "Learn how to gently remove weeds from a garden bed.",
            "Observe an insect in the garden and identify it.",
            "Learn about composting in simple terms.",
            "Help prune a small branch or dead leaf from a plant.",
            "Research a plant that grows well in your local climate.",
            "Start a small indoor herb garden with just one herb."
        ]
    },
    {
        id: 'fitness-nutrition', icon: '🏋️‍♀️🥦', title: 'Fitness & Nutrition', content: 'Deepen your understanding of exercise science and healthy eating for optimal well-being.', tasks: [
            "Research the benefits of protein for muscle growth.",
            "Plan a balanced meal with appropriate portions of carbs, protein, and fats.",
            "Learn about different types of cardio exercises (e.g., HIIT, steady-state).",
            "Understand the concept of 'macronutrients' (protein, carbs, fats).",
            "Perform a dynamic warm-up routine for 10 minutes.",
            "Research the importance of stretching for flexibility.",
            "Identify 3 healthy snack alternatives to processed foods.",
            "Learn about the recommended daily water intake for your age.",
            "Try a new healthy recipe that incorporates a leafy green vegetable.",
            "Research the recommended amount of sleep for your age group."
        ]
    }
];

let pillarsData = [...defaultPillarsData];
let skillsData = [...defaultSkillsData];


const shopItems = [
    {
        id: 'rest-day',
        name: 'Rest Day',
        icon: '🛌',
        description: 'Skip one daily mission! The day will be marked as complete without doing the task.',
        cost: 20
    },
    {
        id: 'instant-tip',
        name: 'Instant Tip',
        icon: '💡',
        description: 'Get an extra motivational tip right now!',
        cost: 8
    },
    {
        id: 'token-bonus',
        name: 'Token Bonus (Minor)',
        icon: '✨',
        description: 'Receive 5 extra Glow Tokens instantly!',
        cost: 15
    },
    {
        id: 'skill-xp-boost',
        name: 'Skill XP Boost',
        icon: '⚡',
        description: 'Doubles tokens earned from your next Daily Skill Focus completion.',
        cost: 30
    },
    {
        id: 'mystery-box',
        name: 'Mystery Box',
        icon: '🎁',
        description: 'A surprise reward! What will you get?',
        cost: 50
    }
];

const badgesData = [
    { id: 'consistency-streak-7', name: '7-Day Streak', icon: '🔥', description: 'Completed daily missions for 7 days in a row!' },
    { id: 'consistency-streak-30', name: '30-Day Streak', icon: '🌟', description: 'Maintained consistency for a whole month!' },
    { id: 'halfway-hero', name: 'Halfway Hero', icon: '🏅', description: 'Reached Day 45 of your 90-day challenge!' },
    { id: 'challenge-master', name: 'Challenge Master', icon: '👑', description: 'Completed all 90 days of the challenge!' },
    { id: 'token-tycoon', name: 'Token Tycoon', icon: '💰', description: 'Collected 50 Glow Tokens!' },
    { id: 'skill-explorer', name: 'Skill Explorer', icon: '🗺️', description: 'Completed 5 tasks across different skills!' },
    { id: 'pillar-powerhouse', name: 'Pillar Powerhouse', icon: '🏛️', description: 'Completed 5 tasks across different pillars!' },
    { id: 'goal-getter', name: 'Goal Getter', icon: '🎯', description: 'Completed your first personal goal!' },
    { id: 'shopaholic', name: 'Shopaholic', icon: '🛍️', description: 'Purchased 3 distinct items from the shop!' }
];


const schedulesData = {
    weekday: `
        <h4 class="font-bold text-lg mb-4 text-primary">Weekday Schedule</h4>
        <ul class="space-y-3 text-secondary">
            <li><strong>5:30-6:00 AM:</strong> Wake Up & Hydrate, Stretch, Wash Face, Brush Teeth.</li>
            <li><strong>6:00-6:30 AM:</strong> Shower, Deodorant, Get Dressed, Fix Hair.</li>
            <li><strong>6:30-7:00 AM:</strong> Healthy Breakfast, Pack Bag, Fill Water Bottle.</li>
            <li><strong>7:00 AM-4:30 PM:</strong> School Time (Participate, stay hydrated).</li>
            <li><strong>4:30-5:30 PM:</strong> Arrive Home, Healthy Snack, Rest (no gadgets).</li>
            <li><strong>5:30-6:30 PM:</strong> Glow-Up Hour (Workout + Daily Mission / Daily Skill Focus).</li>
            <li><strong>6:30-7:30 PM:</strong> Homework & Study.</li>
            <li><strong>7:30-8:30 PM:</strong> Dinner & Family Time.</li>
            <li><strong>8:30-9:30 PM:</strong> Wind Down (Review notes, pick clothes, read, relax).</li>
            <li><strong>9:30-10:00 PM:</strong> Final Prep for Bed (No screens, wash face, brush teeth).</li>
        </ul>
    `,
    weekend: `
        <h4 class="font-bold text-lg mb-4 text-primary">Weekend Schedule</h4>
        <ul class="space-y-3 text-secondary">
            <li><strong>Morning (8 AM-12 PM):</strong> Wake up, Hydrate, Breakfast, Hygiene Routine, Glow-Up Hour (Workout + Mission).</li>
            <li><strong>Afternoon (12 PM-5 PM):</strong> Lunch, Household Chores, 1-hour School Review/Project Work, Free Time/Hobbies.</li>
            <li><strong>Evening (5 PM onwards):</strong> Relax, Dinner, Family Time.</li>
            <li class="pt-2 font-semibold text-amber-600"><strong>Sunday Night:</strong> Do your "Wind Down" routine to prepare for Monday!</li>
        </ul>
    `
};

const journalPrompts = [
    "What was one thing you did today that made you proud?",
    "Describe a challenge you faced today and how you overcame it (or how you plan to).",
    "What are three things you're grateful for today?",
    "If you could give your past self one piece of advice this morning, what would it be?",
    "What new thing did you learn or discover today?",
    "How did you feel about your daily mission today? Why?",
    "What's one small step you can take tomorrow to get closer to a goal?",
    "Describe a moment when you felt truly confident today.",
    "What emotions did you experience today, and what might have caused them?",
    "Write about a positive interaction you had with someone today."
];

let progressChartInstance = null;
let dailyCompletionChartInstance = null;
let streakHistoryChartInstance = null;
let moodTrendChartInstance = null;

// --- State Management ---
function loadState() {
    const savedState = localStorage.getItem('glowUpAppState');
    
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Core App State
        AppState.completedDays = new Set(parsedState.completedDays || []);
        AppState.currentStreak = parsedState.currentStreak || 0;
        AppState.bestStreak = parsedState.bestStreak || 0;
        AppState.dailyActivityMap = parsedState.dailyActivityMap || {};
        for (const date in AppState.dailyActivityMap) {
            if (typeof AppState.dailyActivityMap[date].mood === 'undefined') AppState.dailyActivityMap[date].mood = '';
            if (typeof AppState.dailyActivityMap[date].highlight === 'undefined') AppState.dailyActivityMap[date].highlight = '';
            if (typeof AppState.dailyActivityMap[date].missedReason === 'undefined') AppState.dailyActivityMap[date].missedReason = '';
        }

        AppState.completedSkillTasks = parsedState.completedSkillTasks || {};
        AppState.completedPillarTasks = parsedState.completedPillarTasks || {};
        AppState.tokens = parsedState.tokens || 0;
        AppState.dailyFocusTasks = parsedState.dailyFocusTasks || [];
        AppState.dailyFocusCompletedToday = parsedState.dailyFocusCompletedToday || false;
        AppState.lastDailyFocusDate = parsedState.lastDailyFocusDate || null;
        AppState.nextDailyFocusBonus = parsedState.nextDailyFocusBonus || 0;
        AppState.restDaysAvailable = parsedState.restDaysAvailable || 0;
        AppState.userGoals = parsedState.userGoals || {};
        AppState.globalGoals = parsedState.globalGoals || [];
        AppState.earnedBadges = new Set(parsedState.earnedBadges || []);
        AppState.purchasedShopItems = new Set(parsedState.purchasedShopItems || []);
        AppState.lastSummaryDate = parsedState.lastSummaryDate || null;
        AppState.affirmations = parsedState.affirmations || AppState.affirmations;
        AppState.userAffirmations = parsedState.userAffirmations || [];
        AppState.journalEntries = parsedState.journalEntries || [];
        
        // Personalization & Settings State
        AppState.userName = parsedState.userName || null;
        AppState.difficulty = parsedState.difficulty || 'normal';
        AppState.selectedSkills = new Set(parsedState.selectedSkills || []);
        AppState.isPersonalized = parsedState.isPersonalized || false;
        AppState.theme = parsedState.theme || 'light';
        AppState.customThemeColors = parsedState.customThemeColors || null;
        AppState.notificationsEnabled = typeof parsedState.notificationsEnabled === 'boolean' ? parsedState.notificationsEnabled : true;
        AppState.reduceMotion = typeof parsedState.reduceMotion === 'boolean' ? parsedState.reduceMotion : false;
        AppState.customPillars = parsedState.customPillars || [];
        AppState.customSkills = parsedState.customSkills || [];

        // Initialize dynamic pillar/skill data
        pillarsData = [...defaultPillarsData, ...AppState.customPillars];
        skillsData = [...defaultSkillsData, ...AppState.customSkills];

        AppState.startDate = parsedState.startDate ? new Date(parsedState.startDate) : null;
        AppState.lastVisitDate = parsedState.lastVisitDate || null;
        AppState.currentView = parsedState.currentView || 'dashboard'; // Ensure currentView is loaded
    }

    const todayActual = new Date();
    todayActual.setHours(0, 0, 0, 0);
    const todayFormatted = formatDate(todayActual);

    if (!AppState.startDate) {
        AppState.startDate = new Date(todayActual);
        AppState.lastVisitDate = todayFormatted;
        saveState();
    }

    const diffTime = Math.abs(todayActual.getTime() - AppState.startDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    AppState.today = diffDays + 1;

    // Handle missed days and streak reset on new day visit
    if (AppState.lastVisitDate !== todayFormatted) {
        const yesterdayFormatted = formatDate(new Date(todayActual.getTime() - (24 * 60 * 60 * 1000)));
        const yesterdayActivity = AppState.dailyActivityMap[yesterdayFormatted];
        
        // If yesterday was not completed (main task), break streak
        if (AppState.today > 1 && (!yesterdayActivity || !yesterdayActivity.main)) {
            // Only prompt if a reason hasn't been set for yesterday
            if (!(yesterdayActivity && yesterdayActivity.missedReason)) {
                showMissedReasonModal(yesterdayFormatted);
            }
            AppState.currentStreak = 0; // Break streak regardless if yesterday was missed
        }

        AppState.lastVisitDate = todayFormatted;
        AppState.dailyFocusCompletedToday = false;
        AppState.dailyFocusTasks = [];
        saveState();
    }

    applyTheme(AppState.theme, false); // Apply theme on load
    applyAccessibilitySettings();
}

function saveState() {
    const stateToSave = {
        completedDays: Array.from(AppState.completedDays),
        currentStreak: AppState.currentStreak,
        bestStreak: AppState.bestStreak,
        dailyActivityMap: AppState.dailyActivityMap,
        completedSkillTasks: AppState.completedSkillTasks,
        completedPillarTasks: AppState.completedPillarTasks,
        tokens: AppState.tokens,
        dailyFocusTasks: AppState.dailyFocusTasks,
        dailyFocusCompletedToday: AppState.dailyFocusCompletedToday,
        lastDailyFocusDate: AppState.lastDailyFocusDate,
        nextDailyFocusBonus: AppState.nextDailyFocusBonus,
        restDaysAvailable: AppState.restDaysAvailable,
        userGoals: AppState.userGoals,
        globalGoals: AppState.globalGoals,
        earnedBadges: Array.from(AppState.earnedBadges),
        purchasedShopItems: Array.from(AppState.purchasedShopItems),
        lastSummaryDate: AppState.lastSummaryDate,
        
        userName: AppState.userName,
        difficulty: AppState.difficulty,
        selectedSkills: Array.from(AppState.selectedSkills),
        isPersonalized: AppState.isPersonalized,

        startDate: AppState.startDate ? formatDate(AppState.startDate) : null,
        lastVisitDate: AppState.lastVisitDate,
        currentView: AppState.currentView, // Save current view
        affirmations: AppState.affirmations,
        userAffirmations: AppState.userAffirmations,
        journalEntries: AppState.journalEntries,
        theme: AppState.theme,
        customThemeColors: AppState.customThemeColors,
        notificationsEnabled: AppState.notificationsEnabled,
        reduceMotion: AppState.reduceMotion,
        customPillars: AppState.customPillars,
        customSkills: AppState.customSkills,
    };
    localStorage.setItem('glowUpAppState', JSON.stringify(stateToSave));
}

// --- Theme Management ---
function applyTheme(themeName, save = true) {
    document.documentElement.setAttribute('data-theme', themeName);
    if (save) {
        AppState.theme = themeName;
        saveState();
    }

    const themeSelectElements = document.querySelectorAll('#theme-select, #settings-theme-select');
    themeSelectElements.forEach(select => {
        if (select.value !== themeName) {
            select.value = themeName;
        }
    });

    const customThemeBuilder = document.getElementById('custom-theme-builder');
    if (themeName === 'custom') {
        customThemeBuilder.classList.remove('hidden');
        if (AppState.customThemeColors) {
            for (const [prop, value] of Object.entries(AppState.customThemeColors)) {
                document.documentElement.style.setProperty(prop, value);
                const input = document.getElementById(`custom-${prop.replace('--', '')}`);
                if (input) input.value = value;
            }
        }
    } else {
        customThemeBuilder.classList.add('hidden');
        // Clear custom CSS variables when not on custom theme
        if (AppState.customThemeColors) {
            for (const prop of Object.keys(AppState.customThemeColors)) {
                document.documentElement.style.removeProperty(prop);
            }
        }
    }

    // Re-render charts to pick up new theme colors
    renderProgressChart();
    renderDailyCompletionChart();
    renderStreakHistoryChart();
    renderMoodTrendChart();
}

function saveCustomTheme() {
    const customColors = {};
    const colorInputs = document.querySelectorAll('#custom-theme-builder .color-input');
    colorInputs.forEach(input => {
        const propName = `--${input.id.replace('custom-', '')}`;
        customColors[propName] = input.value;
    });
    AppState.customThemeColors = customColors;
    applyTheme('custom'); // Re-apply theme to pick up new custom colors
    showMessage('Custom theme applied and saved!');
}

function applyAccessibilitySettings() {
    if (AppState.reduceMotion) {
        document.documentElement.style.setProperty('transition', 'none', 'important');
        document.documentElement.style.setProperty('animation', 'none', 'important');
    } else {
        document.documentElement.style.removeProperty('transition');
        document.documentElement.style.removeProperty('animation');
    }
    const reduceMotionToggle = document.getElementById('reduce-motion-toggle');
    if (reduceMotionToggle) {
        reduceMotionToggle.checked = AppState.reduceMotion;
    }
}


// --- View Management ---
function updateView(viewId) {
    document.querySelectorAll('.view, .detail-view').forEach(view => {
        view.classList.add('hidden');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('hidden');
    } else {
        console.error(`View with ID '${viewId}' not found. Defaulting to dashboard.`);
        viewId = 'dashboard'; // Fallback to dashboard
        document.getElementById(viewId).classList.remove('hidden');
    }
    
    const navLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
    if (navLink) {
        navLink.classList.add('active');
    } else {
        console.error(`Nav link for view ID '${viewId}' not found.`);
    }

    AppState.currentView = viewId;
    saveState();

    // Specific rendering calls for each view
    if (viewId === 'dashboard') {
        renderDashboard();
    } else if (viewId === 'plan') {
        renderCalendar();
    } else if (viewId === 'pillars') {
        renderPillars();
    } else if (viewId === 'skills') {
        renderSkills();
    } else if (viewId === 'daily-focus') {
        renderDailyFocus();
        startCountdownTimer();
    } else if (viewId === 'goals') {
        renderGlobalGoals();
    } else if (viewId === 'shop') {
        renderShop();
    } else if (viewId === 'achievements') {
        renderBadges();
    } else if (viewId === 'schedule') {
        renderSchedule(document.getElementById('weekday-btn').classList.contains('bg-amber-500') ? 'weekday' : 'weekend');
    } else if (viewId === 'journal') {
        renderJournal();
    } else if (viewId === 'analytics') {
        renderAnalytics();
    } else if (viewId === 'settings') {
        renderSettings();
    }
}


// --- UI Rendering Functions ---

function renderPersonalizationMenu() {
    const skillsGrid = document.getElementById('personalization-skills-grid');
    if (!skillsGrid) return;
    skillsGrid.innerHTML = '';
    skillsData.forEach(skill => {
        const isSelected = AppState.selectedSkills.has(skill.id);
        skillsGrid.innerHTML += `
            <label class="personalization-skill-item ${isSelected ? 'selected' : ''}">
                <input type="checkbox" data-skill-id="${skill.id}" ${isSelected ? 'checked' : ''}>
                <span class="text-2xl mr-2">${skill.icon}</span>
                <span class="font-medium">${skill.title}</span>
            </label>
        `;
    });

    document.getElementById('user-name').value = AppState.userName || '';
    document.getElementById('difficulty-select').value = AppState.difficulty;

    skillsGrid.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const label = e.target.closest('label');
            if (e.target.checked) {
                AppState.selectedSkills.add(e.target.dataset.skillId);
                label.classList.add('selected');
            } else {
                AppState.selectedSkills.delete(e.target.dataset.skillId);
                label.classList.remove('selected');
            }
            saveState();
        });
    });

    renderUserAffirmations('user-affirmations-list');
}

function renderUserAffirmations(targetElementId) {
    const userAffirmationsList = document.getElementById(targetElementId);
    if (!userAffirmationsList) return;

    userAffirmationsList.innerHTML = '';
    if (AppState.userAffirmations.length === 0) {
        userAffirmationsList.innerHTML = '<p class="text-secondary italic">No custom affirmations yet.</p>';
    } else {
        AppState.userAffirmations.forEach((affirmation, index) => {
            userAffirmationsList.innerHTML += `
                <div class="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                    <span>"${affirmation}"</span>
                    <button data-index="${index}" class="remove-affirmation-btn text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
                </div>
            `;
        });
        userAffirmationsList.querySelectorAll('.remove-affirmation-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.target.dataset.index);
                AppState.userAffirmations.splice(indexToRemove, 1);
                saveState();
                renderUserAffirmations(targetElementId);
                showMessage('Affirmation removed!');
            });
        });
    }
}


async function renderDashboard() {
    const currentChallengeDay = AppState.today > TOTAL_CHALLENGE_DAYS ? TOTAL_CHALLENGE_DAYS : AppState.today;
    const taskForToday = dailyTasks.find(t => t.day === currentChallengeDay) || dailyTasks[dailyTasks.length - 1]; // Fallback to last task
    
    document.getElementById('today-day').textContent = currentChallengeDay;
    document.getElementById('today-task').textContent = taskForToday.task;
    document.getElementById('display-user-name').textContent = AppState.userName || 'Glow-Upper';
    document.getElementById('best-streak').textContent = AppState.bestStreak;
    document.getElementById('rest-days-display').textContent = AppState.restDaysAvailable;

    const allPillars = [...defaultPillarsData, ...AppState.customPillars];
    const todayPillar = allPillars.find(p => p.title.includes(taskForToday.pillar));
    document.getElementById('today-pillar-icon').textContent = todayPillar ? todayPillar.icon : '✨';

    const completeBtn = document.getElementById('complete-today-btn');
    if (AppState.completedDays.has(currentChallengeDay)) {
        completeBtn.textContent = 'Completed!';
        completeBtn.disabled = true;
        completeBtn.classList.remove('gradient-button', 'hover:bg-amber-600');
        completeBtn.classList.add('bg-green-500', 'hover:bg-green-500');
    } else if (AppState.restDaysAvailable > 0) {
        completeBtn.textContent = `Mark as Complete (Use Rest Day: ${AppState.restDaysAvailable})`;
        completeBtn.disabled = false;
        completeBtn.classList.remove('bg-green-500', 'hover:bg-green-500');
        completeBtn.classList.add('gradient-button', 'hover:bg-amber-600');
    } else {
        completeBtn.textContent = 'Mark as Complete';
        completeBtn.disabled = false;
        completeBtn.classList.remove('bg-green-500', 'hover:bg-green-500');
        completeBtn.classList.add('gradient-button', 'hover:bg-amber-600');
    }

    const affirmationDisplay = document.getElementById('daily-affirmation');
    const allAffirmations = [...AppState.affirmations, ...AppState.userAffirmations];

    if (allAffirmations.length > 0) {
        let affirmationText = allAffirmations[Math.floor(Math.random() * allAffirmations.length)];
        const todayFormatted = formatDate(new Date());
        const currentMood = AppState.dailyActivityMap[todayFormatted]?.mood;

        if (AppState.currentStreak > 0 && AppState.currentStreak % 7 === 0) {
            affirmationText = `You're rocking a ${AppState.currentStreak}-day streak! Keep that momentum going! 🔥`;
        } else if (currentMood === '😔' || currentMood === '😡') {
            affirmationText = "It's okay to have tough days. Your resilience shines through! You got this. 💪";
        }
        affirmationDisplay.textContent = affirmationText;
    } else {
        affirmationDisplay.textContent = 'Your daily boost of positivity...';
    }

    const todayFormatted = formatDate(new Date());
    let todayActivity = AppState.dailyActivityMap[todayFormatted] || { main: false, focus: false, mood: '', highlight: '', missedReason: '' };
    document.getElementById('mood-select').value = todayActivity.mood || '';
    document.getElementById('daily-highlight-input').value = todayActivity.highlight || '';

    // Remove old listeners before adding new ones to prevent duplicates
    const moodSelect = document.getElementById('mood-select');
    const dailyHighlightInput = document.getElementById('daily-highlight-input');
    
    // Clear existing event listeners
    moodSelect.removeEventListener('change', AppState.moodSelectHandler);
    dailyHighlightInput.removeEventListener('input', AppState.dailyHighlightInputHandler);

    // Define new handlers and store them in AppState for easy removal
    AppState.moodSelectHandler = (e) => {
        AppState.dailyActivityMap[todayFormatted] = AppState.dailyActivityMap[todayFormatted] || { main: false, focus: false, mood: '', highlight: '', missedReason: '' };
        AppState.dailyActivityMap[todayFormatted].mood = e.target.value;
        saveState();
    };
    AppState.dailyHighlightInputHandler = (e) => {
        AppState.dailyActivityMap[todayFormatted] = AppState.dailyActivityMap[todayFormatted] || { main: false, focus: false, mood: '', highlight: '', missedReason: '' };
        AppState.dailyActivityMap[todayFormatted].highlight = e.target.value;
        saveState();
    };

    // Add new event listeners
    moodSelect.addEventListener('change', AppState.moodSelectHandler);
    dailyHighlightInput.addEventListener('input', AppState.dailyHighlightInputHandler);


    const streakVisualElement = document.getElementById('current-streak-visual');
    if (streakVisualElement) {
        streakVisualElement.innerHTML = '';
        if (AppState.currentStreak > 0) {
            let fireEmojis = '';
            for (let i = 0; i < AppState.currentStreak; i++) {
                fireEmojis += '🔥';
                if (i >= 5) break; // Limit emojis for visual sanity
            }
            streakVisualElement.textContent = `${fireEmojis} ${AppState.currentStreak}`;
        } else {
            streakVisualElement.textContent = `${AppState.currentStreak}`;
        }
    }


    const upcomingMissionsList = document.getElementById('upcoming-missions-list');
    if (upcomingMissionsList) {
        upcomingMissionsList.innerHTML = '';
        // Filter to show tasks that are NOT completed and are in the future
        const upcoming = dailyTasks.filter(task => !AppState.completedDays.has(task.day) && task.day > AppState.today).slice(0, 3);

        if (upcoming.length > 0) {
            upcoming.forEach(mission => {
                upcomingMissionsList.innerHTML += `
                    <div class="flex items-center space-x-2">
                        <span class="text-amber-500 font-semibold">Day ${mission.day}:</span>
                        <span class="text-sm">${mission.task}</span>
                    </div>
                `;
            });
        } else {
            upcomingMissionsList.innerHTML = '<p class="text-sm italic text-secondary">No upcoming missions.</p>';
        }
    }

    renderProgressChart();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    dailyTasks.forEach(task => {
        const dayEl = document.createElement('div');
        dayEl.dataset.day = task.day;
        dayEl.className = 'day-cell h-20 sm:h-24 flex items-center justify-center font-bold text-xl rounded-lg cursor-pointer transition-all duration-300';
        dayEl.textContent = task.day;
        
        // Calculate the actual date for the calendar cell based on startDate
        const cellDate = new Date(AppState.startDate.getTime() + ( (task.day - 1) * 24 * 60 * 60 * 1000) );
        const dayKey = formatDate(cellDate);
        const activity = AppState.dailyActivityMap[dayKey] || { main: false, focus: false };

        let baseClasses = 'bg-secondary shadow-md hover:shadow-xl hover:-translate-y-1 border border-primary';
        if (AppState.completedDays.has(task.day)) {
            if (activity.focus) { // If main task AND daily focus were completed
                baseClasses = 'bg-green-200 text-green-800 shadow-sm border border-green-400 completed-all';
            }
            else { // If only main task was completed
                baseClasses = 'bg-green-100 text-green-700 shadow-sm border border-green-200 completed-main';
            }
        } else if (activity.focus && task.day < AppState.today) { // If only daily focus was completed but main task wasn't, and it's a past day
            baseClasses = 'bg-green-50 text-green-700 shadow-sm border border-green-100 completed-focus';
        }
        else if (task.day < AppState.today) { // If past day and no completion
            baseClasses = 'bg-red-100 text-red-700 shadow-sm border border-red-300 missed';
        }
        
        if (task.day === AppState.today) {
            baseClasses += ' ring-2 ring-amber-500 ring-offset-2';
        }
        
        dayEl.classList.add(...baseClasses.split(' '));
        grid.appendChild(dayEl);
    });
}

function renderPillars() {
    const grid = document.getElementById('pillars-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const allPillars = [...defaultPillarsData, ...AppState.customPillars];
    allPillars.forEach(pillar => {
        grid.innerHTML += `
            <div class="pillar-card card p-6 cursor-pointer" data-pillar-id="${pillar.id}">
                <div class="pillar-card-header">
                    <span class="text-3xl mr-4">${pillar.icon}</span>
                    <h4 class="font-bold text-xl">${pillar.title}</h4>
                </div>
                <span class="view-detail-icon">→</span>
            </div>
        `;
    });
    document.querySelectorAll('.pillar-card').forEach(card => {
        card.addEventListener('click', () => {
            const pillarId = card.dataset.pillarId;
            showPillarDetail(pillarId);
        });
    });
}

function showPillarDetail(pillarId) {
    const allPillars = [...defaultPillarsData, ...AppState.customPillars];
    const pillar = allPillars.find(p => p.id === pillarId);
    if (!pillar) return;

    document.getElementById('pillars').classList.add('hidden');
    const detailView = document.getElementById('pillar-detail-view');
    if (!detailView) return;
    detailView.classList.remove('hidden');

    document.getElementById('pillar-detail-icon').textContent = pillar.icon;
    document.getElementById('pillar-detail-title').textContent = pillar.title;
    document.getElementById('pillar-detail-content').textContent = pillar.content;

    const tasksContainer = document.getElementById('pillar-detail-tasks');
    if (!tasksContainer) return;
    tasksContainer.innerHTML = '';
    
    const completedTasks = AppState.completedPillarTasks[pillar.id] || [];

    pillar.tasks.forEach((taskText, index) => {
        const isCompleted = completedTasks.includes(index);
        tasksContainer.innerHTML += `
            <div class="pillar-task ${isCompleted ? 'completed' : ''}">
                <span class="flex-grow">${taskText}</span>
                <button data-pillar-id="${pillar.id}" data-task-index="${index}" class="pillar-task-btn" ${isCompleted ? 'disabled' : ''}>
                    ${isCompleted ? 'Done' : 'Mark Done'}
                </button>
            </div>
        `;
    });

    const progress = pillar.tasks.length > 0 ? Math.round((completedTasks.length / pillar.tasks.length) * 100) : 0;
    const pillarProgressText = document.getElementById('pillar-progress-text');
    const pillarProgressBar = document.getElementById('pillar-progress-bar');
    if (pillarProgressText) pillarProgressText.textContent = `${progress}%`;
    if (pillarProgressBar) pillarProgressBar.style.width = `${progress}%`;


    // Remove existing listeners before adding new ones to prevent duplicates
    const oldPillarTaskBtns = tasksContainer.querySelectorAll('.pillar-task-btn');
    oldPillarTaskBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    // Add new listeners
    tasksContainer.querySelectorAll('.pillar-task-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const clickedPillarId = e.target.dataset.pillarId;
            const taskIndex = parseInt(e.target.dataset.taskIndex);

            if (!AppState.completedPillarTasks[clickedPillarId]) {
                AppState.completedPillarTasks[clickedPillarId] = [];
            }

            if (!AppState.completedPillarTasks[clickedPillarId].includes(taskIndex)) {
                AppState.completedPillarTasks[clickedPillarId].push(taskIndex);
                saveState();
                checkAchievements();
                showPillarDetail(clickedPillarId); // Re-render detail view to update button state
                showMessage(`Task completed for ${clickedPillarId}!`);
            } else {
                showMessage('Task already completed!');
            }
        });
    });

    renderGoalsForEntity(pillar.id, 'pillar-goals-list', 'add-pillar-goal-input', 'add-pillar-goal-btn');
}

function renderSkills() {
    const grid = document.getElementById('skills-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const allSkills = [...defaultSkillsData, ...AppState.customSkills];
    allSkills.forEach(skill => {
        grid.innerHTML += `
            <div class="skill-card card p-6 cursor-pointer" data-skill-id="${skill.id}">
                <div class="skill-card-header">
                    <span class="text-3xl mr-4">${skill.icon}</span>
                    <h4 class="font-bold text-xl">${skill.title}</h4>
                </div>
                <span class="view-detail-icon">→</span>
            </div>
        `;
    });

    document.querySelectorAll('.skill-card').forEach(card => {
        card.addEventListener('click', () => {
            const skillId = card.dataset.skillId;
            showSkillDetail(skillId);
        });
    });
}

function showSkillDetail(skillId) {
    const allSkills = [...defaultSkillsData, ...AppState.customSkills];
    const skill = allSkills.find(s => s.id === skillId);
    if (!skill) return;

    document.getElementById('skills').classList.add('hidden');
    const detailView = document.getElementById('skill-detail-view');
    if (!detailView) return;
    detailView.classList.remove('hidden');

    document.getElementById('skill-detail-icon').textContent = skill.icon;
    document.getElementById('skill-detail-title').textContent = skill.title;
    document.getElementById('skill-detail-content').textContent = skill.content;

    const tasksContainer = document.getElementById('skill-detail-tasks');
    if (!tasksContainer) return;
    tasksContainer.innerHTML = '';
    
    const completedTasks = AppState.completedSkillTasks[skill.id] || [];

    skill.tasks.forEach((taskText, index) => {
        const isCompleted = completedTasks.includes(index);
        tasksContainer.innerHTML += `
            <div class="skill-task ${isCompleted ? 'completed' : ''}">
                <span class="flex-grow">${taskText}</span>
                <button data-skill-id="${skill.id}" data-task-index="${index}" class="skill-task-btn" ${isCompleted ? 'disabled' : ''}>
                    ${isCompleted ? 'Done' : 'Mark Done'}
                </button>
            </div>
        `;
    });

    const progress = skill.tasks.length > 0 ? Math.round((completedTasks.length / skill.tasks.length) * 100) : 0;
    const skillProgressText = document.getElementById('skill-progress-text');
    const skillProgressBar = document.getElementById('skill-progress-bar');
    if (skillProgressText) skillProgressText.textContent = `${progress}%`;
    if (skillProgressBar) skillProgressBar.style.width = `${progress}%`;

    // Remove existing listeners to prevent duplicates
    const oldSkillTaskBtns = tasksContainer.querySelectorAll('.skill-task-btn');
    oldSkillTaskBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    // Add new listeners
    tasksContainer.querySelectorAll('.skill-task-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const clickedSkillId = e.target.dataset.skillId;
            const taskIndex = parseInt(e.target.dataset.taskIndex);

            if (!AppState.completedSkillTasks[clickedSkillId]) {
                AppState.completedSkillTasks[clickedSkillId] = [];
            }

            if (!AppState.completedSkillTasks[clickedSkillId].includes(taskIndex)) {
                AppState.completedSkillTasks[clickedSkillId].push(taskIndex);
                saveState();
                checkAchievements();
                showSkillDetail(clickedSkillId); // Re-render detail view to update button state
                showMessage(`Task completed for ${clickedSkillId}!`);
            } else {
                showMessage('Task already completed!');
            }
        });
    });

    renderGoalsForEntity(skill.id, 'skill-goals-list', 'add-skill-goal-input', 'add-skill-goal-btn');
}

function renderGoalsForEntity(entityId, listId, inputId, buttonId) {
    const goalsList = document.getElementById(listId);
    if (!goalsList) {
        console.error(`Goals list element with ID '${listId}' not found.`);
        return;
    }
    goalsList.innerHTML = '';
    AppState.userGoals[entityId] = AppState.userGoals[entityId] || [];

    if (AppState.userGoals[entityId].length === 0) {
        goalsList.innerHTML = '<p class="text-secondary italic text-sm">No goals set yet for this area.</p>';
    } else {
        AppState.userGoals[entityId].forEach(goal => {
            goalsList.innerHTML += `
                <div class="goal-item ${goal.completed ? 'completed' : ''}">
                    <label class="flex items-center flex-grow cursor-pointer">
                        <input type="checkbox" class="goal-checkbox mr-3" data-goal-id="${goal.id}" data-entity-id="${entityId}" ${goal.completed ? 'checked disabled' : ''}>
                        <span class="goal-text">${goal.text}</span>
                    </label>
                </div>
            `;
        });
    }

    const addGoalButton = document.getElementById(buttonId);
    const addGoalInput = document.getElementById(inputId);

    // Remove existing listener before adding new one
    const newAddGoalButton = addGoalButton.cloneNode(true);
    addGoalButton.parentNode.replaceChild(newAddGoalButton, addGoalButton);
    newAddGoalButton.onclick = () => {
        const goalText = addGoalInput.value.trim();
        if (goalText) {
            const newGoal = { id: generateUUID(), text: goalText, completed: false };
            AppState.userGoals[entityId].push(newGoal);
            addGoalInput.value = '';
            saveState();
            renderGoalsForEntity(entityId, listId, inputId, buttonId);
            showMessage('Goal added!');
        } else {
            showMessage('Please enter a goal!');
        }
    };


    goalsList.querySelectorAll('.goal-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const goalId = e.target.dataset.goalId;
            const entityId = e.target.dataset.entityId;
            const goal = AppState.userGoals[entityId].find(g => g.id === goalId);
            if (goal && e.target.checked) {
                goal.completed = true;
                e.target.disabled = true;
                saveState();
                checkAchievements();
                renderGoalsForEntity(entityId, listId, inputId, buttonId);
                showMessage('Goal completed! Great job!');
            }
        });
    });
}

function renderGlobalGoals() {
    const globalGoalsList = document.getElementById('global-goals-list');
    if (!globalGoalsList) {
        console.error("Global goals list element not found.");
        return;
    }
    globalGoalsList.innerHTML = '';

    if (AppState.globalGoals.length === 0) {
        globalGoalsList.innerHTML = '<p class="text-secondary italic text-sm">No global goals set yet. Add your first one!</p>';
    } else {
        AppState.globalGoals.forEach(goal => {
            globalGoalsList.innerHTML += `
                <div class="goal-item ${goal.completed ? 'completed' : ''}">
                    <label class="flex items-center flex-grow cursor-pointer">
                        <input type="checkbox" class="goal-checkbox mr-3" data-goal-id="${goal.id}" data-global="true" ${goal.completed ? 'checked disabled' : ''}>
                        <span class="goal-text">${goal.text}</span>
                    </label>
                </div>
            `;
        });
    }

    const addGlobalGoalButton = document.getElementById('add-global-goal-btn');
    const addGlobalGoalInput = document.getElementById('add-global-goal-input');

    // Remove existing listener before adding new one
    const newAddGlobalGoalButton = addGlobalGoalButton.cloneNode(true);
    addGlobalGoalButton.parentNode.replaceChild(newAddGlobalGoalButton, addGlobalGoalButton);
    newAddGlobalGoalButton.onclick = () => {
        const goalText = addGlobalGoalInput.value.trim();
        if (goalText) {
            const newGoal = { id: generateUUID(), text: goalText, completed: false };
            AppState.globalGoals.push(newGoal);
            addGlobalGoalInput.value = '';
            saveState();
            renderGlobalGoals();
            showMessage('Global Goal added!');
        } else {
            showMessage('Please enter a global goal!');
        }
    };

    globalGoalsList.querySelectorAll('.goal-checkbox[data-global="true"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const goalId = e.target.dataset.goalId;
            const goal = AppState.globalGoals.find(g => g.id === goalId);
            if (goal && e.target.checked) {
                goal.completed = true;
                e.target.disabled = true;
                saveState();
                checkAchievements();
                renderGlobalGoals();
                showMessage('Global Goal completed! Awesome!');
            }
        });
    });
}


function renderDailyFocus() {
    const todayFormatted = formatDate(new Date());
    const dailyTasksContainer = document.getElementById('daily-tasks-container');
    const claimTokensBtn = document.getElementById('claim-tokens-btn');
    const tokensDisplay = document.getElementById('tokens-display');
    
    if (!dailyTasksContainer || !claimTokensBtn || !tokensDisplay) {
        console.error("Missing elements for daily focus rendering.");
        return;
    }

    tokensDisplay.textContent = AppState.tokens;

    // Generate new daily tasks if it's a new day or tasks are empty
    if (AppState.lastDailyFocusDate !== todayFormatted || AppState.dailyFocusTasks.length === 0) {
        AppState.dailyFocusCompletedToday = false;
        AppState.lastDailyFocusDate = todayFormatted;
        AppState.dailyFocusTasks = [];

        let availableSkillsForFocus = [];
        // Prioritize user-selected skills for daily focus
        if (AppState.selectedSkills.size > 0) {
            availableSkillsForFocus = Array.from(AppState.selectedSkills);
        } else {
            // If no skills selected, use all default skills
            availableSkillsForFocus = defaultSkillsData.map(s => s.id);
        }

        const allAvailableSkills = [...defaultSkillsData, ...AppState.customSkills];
        const allSkillTasks = [];
        availableSkillsForFocus.forEach(skillId => {
            const skill = allAvailableSkills.find(s => s.id === skillId);
            if (skill) {
                skill.tasks.forEach((taskText, taskIndex) => {
                    allSkillTasks.push({ skillId, taskIndex, taskText, skillIcon: skill.icon });
                });
            }
        });

        // Shuffle all available tasks and pick MAX_DAILY_SKILL_TASKS
        const shuffledAllTasks = allSkillTasks.sort(() => 0.5 - Math.random());
        for (let i = 0; i < Math.min(MAX_DAILY_SKILL_TASKS, shuffledAllTasks.length); i++) {
            const task = shuffledAllTasks[i];
            AppState.dailyFocusTasks.push({
                skillId: task.skillId,
                taskIndex: task.taskIndex,
                taskText: task.taskText,
                skillIcon: task.skillIcon,
                completed: false
            });
        }
        saveState();
    }

    dailyTasksContainer.innerHTML = '';
    if (AppState.dailyFocusTasks.length === 0) {
        dailyTasksContainer.innerHTML = '<p class="text-center text-secondary italic">No daily tasks could be generated today. Try selecting more skills in the personalization menu or adding custom ones!</p>';
        claimTokensBtn.disabled = true;
    } else {
        AppState.dailyFocusTasks.forEach((task, index) => {
            const isCompleted = task.completed;
            dailyTasksContainer.innerHTML += `
                <div class="daily-skill-task-item ${isCompleted ? 'completed' : ''}">
                    <label class="flex items-center flex-grow cursor-pointer">
                        <input type="checkbox" class="daily-skill-task-checkbox mr-3" data-task-index="${index}" ${isCompleted ? 'checked disabled' : ''}>
                        <span class="text-xl mr-2">${task.skillIcon}</span>
                        <span class="flex-grow">${task.taskText}</span>
                    </label>
                </div>
            `;
        });
        
        // Check if all daily focus tasks are completed to enable claim button
        const allTasksCompleted = AppState.dailyFocusTasks.every(task => task.completed);
        if (allTasksCompleted && !AppState.dailyFocusCompletedToday) {
            claimTokensBtn.disabled = false;
        } else {
            claimTokensBtn.disabled = true;
        }
    }

    // Add event listeners for daily focus task checkboxes
    dailyTasksContainer.querySelectorAll('.daily-skill-task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const taskIndex = parseInt(e.target.dataset.task-index);
            if (e.target.checked) {
                AppState.dailyFocusTasks[taskIndex].completed = true;
                e.target.disabled = true; // Disable after checking
                saveState();
                renderDailyFocus(); // Re-render to update claim button
            }
        });
    });
}

function renderShop() {
    const shopItemsGrid = document.getElementById('shop-items-grid');
    const shopTokensDisplay = document.getElementById('shop-tokens-display');
    if (!shopItemsGrid || !shopTokensDisplay) return;

    shopTokensDisplay.textContent = AppState.tokens;
    shopItemsGrid.innerHTML = '';

    shopItems.forEach(item => {
        const isPurchased = AppState.purchasedShopItems.has(item.id);
        const canAfford = AppState.tokens >= item.cost;
        const isDisabled = !canAfford || isPurchased;

        shopItemsGrid.innerHTML += `
            <div class="shop-item-card card p-6 flex flex-col items-center text-center">
                <span class="text-5xl mb-3">${item.icon}</span>
                <h4 class="font-bold text-xl mb-2">${item.name}</h4>
                <p class="text-secondary text-sm mb-4">${item.description}</p>
                <p class="font-semibold text-lg mb-4">Cost: ${item.cost} ✨ Tokens</p>
                <button data-item-id="${item.id}" class="shop-buy-btn w-full py-2 px-4 rounded-lg font-semibold" ${isDisabled ? 'disabled' : ''}>
                    ${isPurchased ? 'Purchased' : (canAfford ? 'Buy Now' : 'Cannot Afford')}
                </button>
            </div>
        `;
    });

    document.querySelectorAll('.shop-buy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemId = e.target.dataset.itemId;
            const item = shopItems.find(i => i.id === itemId);

            if (item && AppState.tokens >= item.cost && !AppState.purchasedShopItems.has(item.id)) {
                AppState.tokens -= item.cost;
                AppState.purchasedShopItems.add(item.id);
                
                // Apply item effect
                if (itemId === 'rest-day') {
                    AppState.restDaysAvailable++;
                    showMessage(`You gained a rest day! You now have ${AppState.restDaysAvailable}.`);
                } else if (itemId === 'instant-tip') {
                    const randomAffirmation = AppState.affirmations[Math.floor(Math.random() * AppState.affirmations.length)];
                    showMessage(`💡 Instant Tip: "${randomAffirmation}"`, true);
                } else if (itemId === 'token-bonus') {
                    AppState.tokens += 5;
                    showMessage('Received 5 bonus tokens!');
                } else if (itemId === 'skill-xp-boost') {
                    AppState.nextDailyFocusBonus = 2; // Double next token reward
                    showMessage('Your next daily skill focus will earn double tokens!');
                } else if (itemId === 'mystery-box') {
                    const rewards = ['5 tokens', '1 rest day', 'random affirmation', 'streak-shield (prevents 1 streak break)'];
                    const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
                    if (randomReward.includes('tokens')) {
                        AppState.tokens += parseInt(randomReward.split(' ')[0]);
                    } else if (randomReward.includes('rest day')) {
                        AppState.restDaysAvailable++;
                    } else if (randomReward.includes('affirmation')) {
                        const affirmation = AppState.affirmations[Math.floor(Math.random() * AppState.affirmations.length)];
                        showMessage(`Mystery Box Reward: A new affirmation! "${affirmation}"`, true);
                    } else if (randomReward.includes('streak-shield')) {
                        // Implement streak shield logic if needed
                        showMessage('Mystery Box Reward: A streak shield! (Future feature)');
                    }
                    showMessage(`Mystery Box Revealed: ${randomReward}!`);
                }
                
                saveState();
                renderShop(); // Re-render shop to update token display and button states
                renderDashboard(); // Update dashboard for rest days display
                checkAchievements();
            } else if (AppState.purchasedShopItems.has(item.id)) {
                showMessage('Item already purchased!', false);
            } else {
                showMessage('Not enough tokens!', false);
            }
        });
    });
}

function renderBadges() {
    const badgesGrid = document.getElementById('badges-grid');
    const noBadgesMsg = document.getElementById('no-badges-msg');
    if (!badgesGrid || !noBadgesMsg) return;

    badgesGrid.innerHTML = '';
    let badgesEarnedCount = 0;

    badgesData.forEach(badge => {
        const isEarned = AppState.earnedBadges.has(badge.id);
        if (isEarned) badgesEarnedCount++;
        badgesGrid.innerHTML += `
            <div class="badge-card ${isEarned ? 'earned' : 'locked'}">
                <span class="badge-icon">${badge.icon}</span>
                <h4 class="font-bold text-lg mb-1">${badge.name}</h4>
                <p class="text-secondary text-sm">${badge.description}</p>
                <span class="badge-status ${isEarned ? 'earned' : 'locked'}">
                    ${isEarned ? 'Earned!' : 'Locked'}
                </span>
            </div>
        `;
    });

    if (badgesEarnedCount === 0) {
        noBadgesMsg.classList.remove('hidden');
    } else {
        noBadgesMsg.classList.add('hidden');
    }
}

function renderSchedule(type) {
    const scheduleContent = document.getElementById('schedule-content');
    const weekdayBtn = document.getElementById('weekday-btn');
    const weekendBtn = document.getElementById('weekend-btn');

    if (!scheduleContent || !weekdayBtn || !weekendBtn) return;

    scheduleContent.innerHTML = schedulesData[type];

    if (type === 'weekday') {
        weekdayBtn.classList.add('bg-amber-500', 'text-white');
        weekdayBtn.classList.remove('bg-slate-200', 'text-slate-600');
        weekendBtn.classList.remove('bg-amber-500', 'text-white');
        weekendBtn.classList.add('bg-slate-200', 'text-slate-600');
    } else {
        weekendBtn.classList.add('bg-amber-500', 'text-white');
        weekendBtn.classList.remove('bg-slate-200', 'text-slate-600');
        weekdayBtn.classList.remove('bg-amber-500', 'text-white');
        weekdayBtn.classList.add('bg-slate-200', 'text-slate-600');
    }
}

async function renderJournal() {
    const journalInput = document.getElementById('journal-input');
    const journalMoodSelect = document.getElementById('journal-mood-select');
    const journalEntriesList = document.getElementById('journal-entries-list');
    const journalPromptElement = document.getElementById('journal-prompt');
    const todayFormatted = formatDate(new Date());

    if (!journalInput || !journalMoodSelect || !journalEntriesList || !journalPromptElement) return;

    // Set today's prompt
    journalPromptElement.textContent = journalPrompts[Math.floor(Math.random() * journalPrompts.length)];

    // Load today's journal entry if it exists
    const todayEntry = AppState.journalEntries.find(entry => entry.date === todayFormatted);
    if (todayEntry) {
        journalInput.value = todayEntry.content || '';
        journalMoodSelect.value = todayEntry.mood || '';
    } else {
        journalInput.value = '';
        journalMoodSelect.value = '';
    }

    // Filter and render past entries
    renderFilteredJournalEntries();
}

function renderFilteredJournalEntries() {
    const journalEntriesList = document.getElementById('journal-entries-list');
    const filterDate = document.getElementById('journal-filter-date').value;
    const searchTerm = document.getElementById('journal-search-input').value.toLowerCase();

    if (!journalEntriesList) return;

    journalEntriesList.innerHTML = '';
    const filteredEntries = AppState.journalEntries.filter(entry => {
        const matchesDate = !filterDate || entry.date === filterDate;
        const matchesSearch = !searchTerm || entry.content.toLowerCase().includes(searchTerm) || entry.mood.toLowerCase().includes(searchTerm) || (entry.highlight && entry.highlight.toLowerCase().includes(searchTerm));
        return matchesDate && matchesSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by newest first

    if (filteredEntries.length === 0) {
        journalEntriesList.innerHTML = '<p class="text-center text-secondary italic">No journal entries match your filters.</p>';
    } else {
        filteredEntries.forEach(entry => {
            journalEntriesList.innerHTML += `
                <div class="journal-entry">
                    <div class="journal-entry-meta flex justify-between items-center mb-2">
                        <span class="font-semibold text-primary">${entry.date}</span>
                        <span class="text-secondary">${entry.mood}</span>
                    </div>
                    <p class="text-primary mb-2">${entry.content}</p>
                    ${entry.highlight ? `<p class="text-secondary text-sm italic">Highlight: ${entry.highlight}</p>` : ''}
                    <button data-id="${entry.id}" class="delete-journal-entry-btn text-red-500 hover:text-red-700 text-sm mt-3 float-right">Delete</button>
                </div>
            `;
        });

        journalEntriesList.querySelectorAll('.delete-journal-entry-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entryIdToDelete = e.target.dataset.id;
                AppState.journalEntries = AppState.journalEntries.filter(entry => entry.id !== entryIdToDelete);
                saveState();
                renderFilteredJournalEntries();
                showMessage('Journal entry deleted!');
            });
        });
    }
}

function renderAnalytics() {
    renderDailyCompletionChart();
    renderStreakHistoryChart();
    renderMoodTrendChart();
    renderPillarsSkillsProgress();
    renderGoalProgressOverview();
    renderAchievementsOverview();
}

function getChartColors() {
    const style = getComputedStyle(document.body);
    return {
        primary: style.getPropertyValue('--brand-primary').trim(),
        secondary: style.getPropertyValue('--brand-secondary').trim(),
        textPrimary: style.getPropertyValue('--text-primary').trim(),
        textSecondary: style.getPropertyValue('--text-secondary').trim(),
        bgSecondary: style.getPropertyValue('--bg-secondary').trim(),
        borderPrimary: style.getPropertyValue('--border-primary').trim()
    };
}

function renderProgressChart() {
    const ctx = document.getElementById('progressChart');
    if (!ctx) {
        console.error("progressChart canvas not found.");
        return;
    }
    const { primary, secondary, textPrimary, textSecondary, bgSecondary, borderPrimary } = getChartColors();

    if (progressChartInstance) {
        progressChartInstance.destroy();
    }

    const completedCount = AppState.completedDays.size;
    const remainingDays = TOTAL_CHALLENGE_DAYS - AppState.today; // Days left to reach 90
    const progressPercentage = TOTAL_CHALLENGE_DAYS > 0 ? Math.round((completedCount / TOTAL_CHALLENGE_DAYS) * 100) : 0;

    let message = '';
    if (progressPercentage === 100) {
        message = 'You\'ve completed the entire 90-Day Challenge! Amazing!';
    } else if (AppState.today > TOTAL_CHALLENGE_DAYS) {
        message = `You've passed Day ${TOTAL_CHALLENGE_DAYS}! You completed ${completedCount} days.`;
    } else {
        message = `You are ${progressPercentage}% through your journey! Keep pushing!`;
    }
    document.getElementById('progress-message').textContent = message;

    progressChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Current Day', 'Remaining'],
            datasets: [{
                data: [
                    completedCount,
                    AppState.completedDays.has(AppState.today) ? 0 : 1, // Current day
                    Math.max(0, TOTAL_CHALLENGE_DAYS - completedCount - (AppState.completedDays.has(AppState.today) ? 0 : 1))
                ],
                backgroundColor: [primary, secondary, borderPrimary],
                borderColor: bgSecondary,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textSecondary,
                        font: { family: 'Inter' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed;
                            }
                            return label;
                        }
                    },
                    bodyFont: { family: 'Inter' },
                    titleFont: { family: 'Inter' }
                }
            },
            elements: {
                arc: {
                    hoverBorderColor: textPrimary,
                    hoverBorderWidth: 3
                }
            }
        }
    });
}

function renderDailyCompletionChart() {
    const ctx = document.getElementById('dailyCompletionChart');
    if (!ctx) return;
    const { primary, textSecondary, bgSecondary, borderPrimary } = getChartColors();

    if (dailyCompletionChartInstance) {
        dailyCompletionChartInstance.destroy();
    }

    const labels = [];
    const completionData = []; // 1 for completed, 0 for not
    const missedData = []; // 1 for missed, 0 for not

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 1; i <= AppState.today; i++) {
        const dayDate = new Date(AppState.startDate.getTime() + ((i - 1) * 24 * 60 * 60 * 1000));
        const dayFormatted = formatDate(dayDate);
        labels.push(`Day ${i}`);

        const activity = AppState.dailyActivityMap[dayFormatted] || { main: false };
        if (activity.main) {
            completionData.push(1);
            missedData.push(0);
        } else if (i < AppState.today) { // Past day and not completed
            completionData.push(0);
            missedData.push(1);
        } else { // Current day, not yet completed
            completionData.push(0);
            missedData.push(0);
        }
    }

    dailyCompletionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Completed',
                    data: completionData,
                    backgroundColor: primary,
                    borderColor: primary,
                    borderWidth: 1,
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Missed',
                    data: missedData,
                    backgroundColor: 'rgba(239, 68, 68, 0.7)', // Tailwind red-500 with opacity
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1,
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Challenge Day',
                        color: textSecondary,
                        font: { family: 'Inter', size: 14 }
                    },
                    ticks: {
                        color: textSecondary,
                        font: { family: 'Inter' }
                    },
                    grid: {
                        color: borderPrimary
                    }
                },
                y: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Status (1 = Completed/Missed)',
                        color: textSecondary,
                        font: { family: 'Inter', size: 14 }
                    },
                    ticks: {
                        color: textSecondary,
                        font: { family: 'Inter' },
                        stepSize: 1,
                        callback: function(value) {
                            return value === 1 ? 'Day' : ''; // Only show 1 as 'Day'
                        }
                    },
                    grid: {
                        color: borderPrimary
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textSecondary,
                        font: { family: 'Inter' }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label === 'Completed' && context.parsed.y === 1) {
                                return 'Day Completed';
                            } else if (label === 'Missed' && context.parsed.y === 1) {
                                const dayDate = new Date(AppState.startDate.getTime() + ((parseInt(context.label.replace('Day ', '')) - 1) * 24 * 60 * 60 * 1000));
                                const dayFormatted = formatDate(dayDate);
                                const activity = AppState.dailyActivityMap[dayFormatted];
                                return `Day Missed: ${activity?.missedReason || 'No reason recorded'}`;
                            }
                            return null; // Hide labels for 0 values
                        }
                    },
                    bodyFont: { family: 'Inter' },
                    titleFont: { family: 'Inter' }
                }
            }
        }
    });
}

function renderStreakHistoryChart() {
    const ctx = document.getElementById('streakHistoryChart');
    if (!ctx) return;
    const { primary, secondary, textSecondary, bgSecondary, borderPrimary } = getChartColors();

    if (streakHistoryChartInstance) {
        streakHistoryChartInstance.destroy();
    }

    const labels = [];
    const streakData = [];

    // Simulate streak history for the purpose of the chart
    // In a real app, you might record streak length daily or upon streak breakage.
    let currentSimulatedStreak = 0;
    const streakHistory = [];

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 1; i <= AppState.today; i++) {
        const dayDate = new Date(AppState.startDate.getTime() + ((i - 1) * 24 * 60 * 60 * 1000));
        const dayFormatted = formatDate(dayDate);
        labels.push(`Day ${i}`);

        const activity = AppState.dailyActivityMap[dayFormatted] || { main: false };
        if (activity.main) {
            currentSimulatedStreak++;
        } else if (i < AppState.today) { // If it's a past day and not completed, streak breaks
            currentSimulatedStreak = 0;
        }
        // For the current day, we show the current streak based on AppState.currentStreak
        if (i === AppState.today) {
            streakData.push(AppState.currentStreak);
        } else {
            streakData.push(currentSimulatedStreak);
        }
    }

    // Adjust labels to be more readable for longer periods
    const displayLabels = labels.filter((_, idx) => idx % Math.ceil(labels.length / 10) === 0);

    streakHistoryChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Streak',
                data: streakData,
                borderColor: primary,
                backgroundColor: 'transparent',
                tension: 0.1,
                pointBackgroundColor: primary,
                pointBorderColor: primary,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Challenge Day',
                        color: textSecondary,
                        font: { family: 'Inter', size: 14 }
                    },
                    ticks: {
                        color: textSecondary,
                        font: { family: 'Inter' },
                        autoSkip: true,
                        maxTicksLimit: 10 // Limit the number of ticks
                    },
                    grid: {
                        color: borderPrimary
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Streak Length (Days)',
                        color: textSecondary,
                        font: { family: 'Inter', size: 14 }
                    },
                    ticks: {
                        color: textSecondary,
                        font: { family: 'Inter' },
                        precision: 0 // Ensure whole numbers
                    },
                    grid: {
                        color: borderPrimary
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textSecondary,
                        font: { family: 'Inter' }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    bodyFont: { family: 'Inter' },
                    titleFont: { family: 'Inter' }
                }
            }
        }
    });
}

function renderMoodTrendChart() {
    const ctx = document.getElementById('moodTrendChart');
    if (!ctx) return;
    const { primary, secondary, textSecondary, bgSecondary, borderPrimary } = getChartColors();

    if (moodTrendChartInstance) {
        moodTrendChartInstance.destroy();
    }

    const labels = [];
    const moodData = []; // Map moods to numerical values
    const moodMap = {
        '😃': 5, // Great!
        '😊': 4, // Good
        '😐': 3, // Okay
        '😔': 2, // Down
        '😡': 1  // Frustrated
    };

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 1; i <= AppState.today; i++) {
        const dayDate = new Date(AppState.startDate.getTime() + ((i - 1) * 24 * 60 * 60 * 1000));
        const dayFormatted = formatDate(dayDate);
        labels.push(`Day ${i}`);

        const activity = AppState.dailyActivityMap[dayFormatted] || { mood: '' };
        moodData.push(moodMap[activity.mood] || null); // Push null if no mood recorded
    }

    moodTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Mood',
                data: moodData,
                borderColor: primary,
                backgroundColor: 'rgba(245, 158, 11, 0.2)', // brand-primary with opacity
                fill: true,
                tension: 0.3,
                pointBackgroundColor: primary,
                pointBorderColor: primary,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Challenge Day',
                        color: textSecondary,
                        font: { family: 'Inter', size: 14 }
                    },
                    ticks: {
                        color: textSecondary,
                        font: { family: 'Inter' },
                        autoSkip: true,
                        maxTicksLimit: 10
                    },
                    grid: {
                        color: borderPrimary
                    }
                },
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 5,
                    title: {
                        display: true,
                        text: 'Mood Rating (1=Frustrated, 5=Great)',
                        color: textSecondary,
                        font: { family: 'Inter', size: 14 }
                    },
                    ticks: {
                        color: textSecondary,
                        font: { family: 'Inter' },
                        stepSize: 1,
                        callback: function(value, index, values) {
                            const reverseMoodMap = Object.keys(moodMap).find(key => moodMap[key] === value);
                            return reverseMoodMap ? `${reverseMoodMap} (${value})` : '';
                        }
                    },
                    grid: {
                        color: borderPrimary
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textSecondary,
                        font: { family: 'Inter' }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (context.parsed.y !== null) {
                                const reverseMoodMap = Object.keys(moodMap).find(key => moodMap[key] === context.parsed.y);
                                label += `: ${reverseMoodMap || 'N/A'}`;
                            }
                            return label;
                        }
                    },
                    bodyFont: { family: 'Inter' },
                    titleFont: { family: 'Inter' }
                }
            }
        }
    });
}


function renderPillarsSkillsProgress() {
    const container = document.getElementById('analytics-pillars-skills-progress');
    if (!container) return;

    container.innerHTML = `
        <h4 class="font-bold text-lg text-primary mb-3">Pillars:</h4>
        <div id="analytics-pillars-list" class="space-y-2"></div>
        <h4 class="font-bold text-lg text-primary mb-3 mt-6">Skills:</h4>
        <div id="analytics-skills-list" class="space-y-2"></div>
    `;

    const pillarsList = document.getElementById('analytics-pillars-list');
    const skillsList = document.getElementById('analytics-skills-list');

    // Render Pillars Progress
    pillarsData.forEach(pillar => {
        const completedTasksCount = AppState.completedPillarTasks[pillar.id] ? AppState.completedPillarTasks[pillar.id].length : 0;
        const totalTasks = pillar.tasks.length;
        const progress = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;
        
        pillarsList.innerHTML += `
            <div class="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-200">
                <span class="flex items-center">
                    <span class="text-xl mr-2">${pillar.icon}</span>
                    <span class="font-medium text-primary">${pillar.title}:</span>
                </span>
                <span class="font-semibold text-brand-primary">${progress}%</span>
            </div>
        `;
    });

    // Render Skills Progress
    skillsData.forEach(skill => {
        const completedTasksCount = AppState.completedSkillTasks[skill.id] ? AppState.completedSkillTasks[skill.id].length : 0;
        const totalTasks = skill.tasks.length;
        const progress = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

        skillsList.innerHTML += `
            <div class="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-200">
                <span class="flex items-center">
                    <span class="text-xl mr-2">${skill.icon}</span>
                    <span class="font-medium text-primary">${skill.title}:</span>
                </span>
                <span class="font-semibold text-brand-primary">${progress}%</span>
            </div>
        `;
    });
}

function renderGoalProgressOverview() {
    const container = document.getElementById('analytics-goal-progress');
    if (!container) return;

    container.innerHTML = '<h4 class="font-bold text-lg text-primary mb-3">Global Goals:</h4><div id="analytics-global-goals-list" class="space-y-2"></div>';
    
    const globalGoalsList = document.getElementById('analytics-global-goals-list');
    if (AppState.globalGoals.length === 0) {
        globalGoalsList.innerHTML = '<p class="text-secondary italic text-sm">No global goals set yet.</p>';
    } else {
        AppState.globalGoals.forEach(goal => {
            globalGoalsList.innerHTML += `
                <div class="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-200 ${goal.completed ? 'completed' : ''}">
                    <span class="flex items-center">
                        <span class="text-lg mr-2">${goal.completed ? '✅' : '⏳'}</span>
                        <span class="font-medium text-primary">${goal.text}</span>
                    </span>
                    <span class="text-sm font-semibold ${goal.completed ? 'text-green-600' : 'text-orange-600'}">
                        ${goal.completed ? 'Completed' : 'In Progress'}
                    </span>
                </div>
            `;
        });
    }

    container.innerHTML += '<h4 class="font-bold text-lg text-primary mb-3 mt-6">Pillar/Skill Specific Goals:</h4><div id="analytics-entity-goals-list" class="space-y-2"></div>';
    const entityGoalsList = document.getElementById('analytics-entity-goals-list');
    let hasEntityGoals = false;

    for (const entityId in AppState.userGoals) {
        if (entityId === 'global') continue; // Skip global goals as they are handled above
        
        const entityGoals = AppState.userGoals[entityId];
        if (entityGoals.length > 0) {
            hasEntityGoals = true;
            const entity = pillarsData.find(p => p.id === entityId) || skillsData.find(s => s.id === entityId);
            const entityTitle = entity ? entity.title : `Unknown Entity (${entityId})`;

            entityGoalsList.innerHTML += `<p class="font-semibold text-sm text-secondary mt-4 mb-2">${entityTitle}:</p>`;
            entityGoals.forEach(goal => {
                entityGoalsList.innerHTML += `
                    <div class="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-200 ${goal.completed ? 'completed' : ''}">
                        <span class="flex items-center">
                            <span class="text-lg mr-2">${goal.completed ? '✅' : '⏳'}</span>
                            <span class="font-medium text-primary">${goal.text}</span>
                        </span>
                        <span class="text-sm font-semibold ${goal.completed ? 'text-green-600' : 'text-orange-600'}">
                            ${goal.completed ? 'Completed' : 'In Progress'}
                        </span>
                    </div>
                `;
            });
        }
    }

    if (!hasEntityGoals) {
        entityGoalsList.innerHTML = '<p class="text-secondary italic text-sm">No pillar or skill specific goals set yet.</p>';
    }
}

function renderAchievementsOverview() {
    const container = document.getElementById('analytics-achievements-overview');
    if (!container) return;

    container.innerHTML = '';
    let earnedCount = 0;

    badgesData.forEach(badge => {
        const isEarned = AppState.earnedBadges.has(badge.id);
        if (isEarned) {
            earnedCount++;
            container.innerHTML += `
                <div class="card p-4 flex items-center space-x-3 bg-green-50 border-green-200">
                    <span class="text-3xl">${badge.icon}</span>
                    <div>
                        <h4 class="font-bold text-md text-green-800">${badge.name}</h4>
                        <p class="text-sm text-green-700">Earned!</p>
                    </div>
                </div>
            `;
        }
    });

    if (earnedCount === 0) {
        container.innerHTML = '<p class="text-sm italic text-secondary col-span-full">No achievements earned yet. Keep up the great work!</p>';
    }
}


function renderSettings() {
    document.getElementById('settings-user-name').value = AppState.userName || '';
    document.getElementById('settings-difficulty-select').value = AppState.difficulty;
    document.getElementById('notification-toggle').checked = AppState.notificationsEnabled;
    document.getElementById('reduce-motion-toggle').checked = AppState.reduceMotion;
    document.getElementById('settings-theme-select').value = AppState.theme;

    // Render custom affirmations in settings
    renderUserAffirmations('settings-user-affirmations-list');

    // Render custom pillars in settings
    const customPillarsList = document.getElementById('settings-custom-pillars-list');
    if (customPillarsList) {
        customPillarsList.innerHTML = '';
        if (AppState.customPillars.length === 0) {
            customPillarsList.innerHTML = '<p class="text-secondary italic text-sm">No custom pillars added yet.</p>';
        } else {
            AppState.customPillars.forEach((pillar, index) => {
                customPillarsList.innerHTML += `
                    <div class="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                        <span class="flex items-center"><span class="text-xl mr-2">${pillar.icon}</span> ${pillar.title}</span>
                        <button data-id="${pillar.id}" class="edit-custom-pillar-btn text-blue-500 hover:text-blue-700 mr-2">Edit</button>
                        <button data-id="${pillar.id}" class="remove-custom-pillar-btn text-red-500 hover:text-red-700">&times;</button>
                    </div>
                `;
            });
            customPillarsList.querySelectorAll('.remove-custom-pillar-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idToRemove = e.target.dataset.id;
                    AppState.customPillars = AppState.customPillars.filter(p => p.id !== idToRemove);
                    pillarsData = [...defaultPillarsData, ...AppState.customPillars]; // Update global reference
                    saveState();
                    renderSettings();
                    showMessage('Custom Pillar removed!');
                });
            });
            customPillarsList.querySelectorAll('.edit-custom-pillar-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idToEdit = e.target.dataset.id;
                    showCustomPillarSkillModal('edit-pillar', idToEdit);
                });
            });
        }
    }

    // Render custom skills in settings
    const customSkillsList = document.getElementById('settings-custom-skills-list');
    if (customSkillsList) {
        customSkillsList.innerHTML = '';
        if (AppState.customSkills.length === 0) {
            customSkillsList.innerHTML = '<p class="text-secondary italic text-sm">No custom skills added yet.</p>';
        } else {
            AppState.customSkills.forEach((skill, index) => {
                customSkillsList.innerHTML += `
                    <div class="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                        <span class="flex items-center"><span class="text-xl mr-2">${skill.icon}</span> ${skill.title}</span>
                        <button data-id="${skill.id}" class="edit-custom-skill-btn text-blue-500 hover:text-blue-700 mr-2">Edit</button>
                        <button data-id="${skill.id}" class="remove-custom-skill-btn text-red-500 hover:text-red-700">&times;</button>
                    </div>
                `;
            });
            customSkillsList.querySelectorAll('.remove-custom-skill-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idToRemove = e.target.dataset.id;
                    AppState.customSkills = AppState.customSkills.filter(s => s.id !== idToRemove);
                    skillsData = [...defaultSkillsData, ...AppState.customSkills]; // Update global reference
                    saveState();
                    renderSettings();
                    showMessage('Custom Skill removed!');
                });
            });
            customSkillsList.querySelectorAll('.edit-custom-skill-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idToEdit = e.target.dataset.id;
                    showCustomPillarSkillModal('edit-skill', idToEdit);
                });
            });
        }
    }

    // Show/hide custom theme builder based on selected theme
    const settingsThemeSelect = document.getElementById('settings-theme-select');
    if (settingsThemeSelect && settingsThemeSelect.value === 'custom') {
        document.getElementById('custom-theme-builder').classList.remove('hidden');
    } else {
        document.getElementById('custom-theme-builder').classList.add('hidden');
    }
}


// --- Modals and Messages ---
function showMessage(message, isSuccess = true) {
    const msgBox = document.getElementById('message-box');
    if (!msgBox) return;

    msgBox.textContent = message;
    msgBox.style.backgroundColor = isSuccess ? 'var(--brand-primary)' : 'rgb(239, 68, 68)'; // Tailwind red-500
    msgBox.style.color = isSuccess ? 'white' : 'white';
    
    // Animate in
    msgBox.style.transform = 'translateY(0)';
    msgBox.style.opacity = '1';

    setTimeout(() => {
        // Animate out
        msgBox.style.transform = 'translateY(20px)';
        msgBox.style.opacity = '0';
    }, 3000);
}

function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showMissedReasonModal(dateKey) {
    const modal = document.getElementById('missed-reason-modal');
    if (!modal) return;
    document.getElementById('submit-missed-reason-btn').dataset.dateKey = dateKey;
    showModal('missed-reason-modal');
}

let customModalMode = ''; // 'add-pillar', 'edit-pillar', 'add-skill', 'edit-skill'
let customModalEntityId = null; // For editing mode

function showCustomPillarSkillModal(mode, entityId = null) {
    customModalMode = mode;
    customModalEntityId = entityId;

    const modal = document.getElementById('custom-pillar-skill-modal');
    const modalTitle = document.getElementById('custom-modal-title');
    const nameInput = document.getElementById('custom-name-input');
    const iconInput = document.getElementById('custom-icon-input');
    const contentInput = document.getElementById('custom-content-input');
    const tasksInput = document.getElementById('custom-tasks-input');
    const saveBtn = document.getElementById('save-custom-btn');

    if (!modal || !modalTitle || !nameInput || !iconInput || !contentInput || !tasksInput || !saveBtn) {
        console.error("Missing elements for custom pillar/skill modal.");
        return;
    }

    // Reset form fields
    nameInput.value = '';
    iconInput.value = '';
    contentInput.value = '';
    tasksInput.value = '';

    if (mode === 'add-pillar') {
        modalTitle.textContent = 'Add New Pillar';
    } else if (mode === 'add-skill') {
        modalTitle.textContent = 'Add New Skill';
    } else if (mode === 'edit-pillar' && entityId) {
        modalTitle.textContent = 'Edit Pillar';
        const pillar = AppState.customPillars.find(p => p.id === entityId);
        if (pillar) {
            nameInput.value = pillar.title;
            iconInput.value = pillar.icon;
            contentInput.value = pillar.content;
            tasksInput.value = pillar.tasks.join('\n');
        }
    } else if (mode === 'edit-skill' && entityId) {
        modalTitle.textContent = 'Edit Skill';
        const skill = AppState.customSkills.find(s => s.id === entityId);
        if (skill) {
            nameInput.value = skill.title;
            iconInput.value = skill.icon;
            contentInput.value = skill.content;
            tasksInput.value = skill.tasks.join('\n');
        }
    }

    showModal('custom-pillar-skill-modal');
}


// --- Achievements Logic ---
function checkAchievements() {
    // Consistency Streaks
    if (AppState.currentStreak >= 7 && !AppState.earnedBadges.has('consistency-streak-7')) {
        AppState.earnedBadges.add('consistency-streak-7');
        showMessage('Achievement Unlocked: 7-Day Streak! 🔥', true);
    }
    if (AppState.currentStreak >= 30 && !AppState.earnedBadges.has('consistency-streak-30')) {
        AppState.earnedBadges.add('consistency-streak-30');
        showMessage('Achievement Unlocked: 30-Day Streak! 🌟', true);
    }

    // Halfway Hero
    if (AppState.today >= 45 && !AppState.earnedBadges.has('halfway-hero')) {
        AppState.earnedBadges.add('halfway-hero');
        showMessage('Achievement Unlocked: Halfway Hero! 🏅', true);
    }

    // Challenge Master
    if (AppState.completedDays.size >= TOTAL_CHALLENGE_DAYS && !AppState.earnedBadges.has('challenge-master')) {
        AppState.earnedBadges.add('challenge-master');
        showMessage('Achievement Unlocked: Challenge Master! 👑', true);
    }

    // Token Tycoon
    if (AppState.tokens >= 50 && !AppState.earnedBadges.has('token-tycoon')) {
        AppState.earnedBadges.add('token-tycoon');
        showMessage('Achievement Unlocked: Token Tycoon! 💰', true);
    }

    // Skill Explorer (completed tasks across different skills)
    const distinctSkillsCompleted = new Set(Object.keys(AppState.completedSkillTasks).filter(skillId => AppState.completedSkillTasks[skillId].length > 0));
    if (distinctSkillsCompleted.size >= 5 && !AppState.earnedBadges.has('skill-explorer')) {
        AppState.earnedBadges.add('skill-explorer');
        showMessage('Achievement Unlocked: Skill Explorer! 🗺️', true);
    }

    // Pillar Powerhouse (completed tasks across different pillars)
    const distinctPillarsCompleted = new Set(Object.keys(AppState.completedPillarTasks).filter(pillarId => AppState.completedPillarTasks[pillarId].length > 0));
    if (distinctPillarsCompleted.size >= 5 && !AppState.earnedBadges.has('pillar-powerhouse')) {
        AppState.earnedBadges.add('pillar-powerhouse');
        showMessage('Achievement Unlocked: Pillar Powerhouse! 🏛️', true);
    }

    // Goal Getter (completed first global goal)
    if (AppState.globalGoals.some(g => g.completed) && !AppState.earnedBadges.has('goal-getter')) {
        AppState.earnedBadges.add('goal-getter');
        showMessage('Achievement Unlocked: Goal Getter! 🎯', true);
    }

    // Shopaholic
    if (AppState.purchasedShopItems.size >= 3 && !AppState.earnedBadges.has('shopaholic')) {
        AppState.earnedBadges.add('shopaholic');
        showMessage('Achievement Unlocked: Shopaholic! 🛍️', true);
    }

    saveState();
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadState(); // Load state first

    // Check if user has personalized the app
    if (!AppState.isPersonalized) {
        document.getElementById('personalization-menu').classList.remove('hidden');
        document.getElementById('app-main-content').classList.add('hidden');
        renderPersonalizationMenu();
    } else {
        document.getElementById('personalization-menu').classList.add('hidden');
        document.getElementById('app-main-content').classList.remove('hidden');
        updateView(AppState.currentView); // Render the last saved view
    }

    // Personalization Start Button
    document.getElementById('start-glow-up-btn').addEventListener('click', () => {
        const userName = document.getElementById('user-name').value.trim();
        if (!userName) {
            showMessage('Please enter your name!', false);
            return;
        }
        if (AppState.selectedSkills.size === 0) {
            showMessage('Please select at least one skill to start your journey!', false);
            return;
        }
        AppState.userName = userName;
        AppState.difficulty = document.getElementById('difficulty-select').value;
        AppState.isPersonalized = true;
        AppState.startDate = new Date(); // Set start date when personalization is complete
        AppState.startDate.setHours(0,0,0,0); // Normalize to start of day
        AppState.lastVisitDate = formatDate(new Date());
        saveState();
        document.getElementById('personalization-menu').classList.add('hidden');
        document.getElementById('app-main-content').classList.remove('hidden');
        updateView('dashboard'); // Go to dashboard after personalization
        showMessage('Welcome to your Glow-Up Journey!', true);
    });

    // Add Affirmation Button (Personalization Menu)
    document.getElementById('add-affirmation-btn').addEventListener('click', () => {
        const input = document.getElementById('custom-affirmation-input');
        const affirmation = input.value.trim();
        if (affirmation) {
            AppState.userAffirmations.push(affirmation);
            input.value = '';
            saveState();
            renderUserAffirmations('user-affirmations-list');
            showMessage('Affirmation added!');
        } else {
            showMessage('Please enter an affirmation.', false);
        }
    });


    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            updateView(e.target.dataset.view);
        });
    });

    // Calendar Day Click (from plan view)
    document.getElementById('calendar-grid').addEventListener('click', (e) => {
        const dayCell = e.target.closest('.day-cell');
        if (dayCell) {
            const day = parseInt(dayCell.dataset.day);
            const task = dailyTasks.find(t => t.day === day);
            if (task) {
                document.getElementById('modal-day').textContent = task.day;
                document.getElementById('modal-task').textContent = task.task;
                showModal('task-modal');
            }
        }
    });

    // Close Task Modal
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        hideModal('task-modal');
    });

    // Complete Today Button
    document.getElementById('complete-today-btn').addEventListener('click', () => {
        const currentChallengeDay = AppState.today > TOTAL_CHALLENGE_DAYS ? TOTAL_CHALLENGE_DAYS : AppState.today;
        const todayFormatted = formatDate(new Date());

        if (AppState.completedDays.has(currentChallengeDay)) {
            showMessage('You already completed today\'s mission!', false);
            return;
        }

        if (AppState.restDaysAvailable > 0) {
            AppState.restDaysAvailable--;
            AppState.completedDays.add(currentChallengeDay);
            // Don't update streak or add tokens for rest days, just mark as complete
            AppState.dailyActivityMap[todayFormatted] = AppState.dailyActivityMap[todayFormatted] || {};
            AppState.dailyActivityMap[todayFormatted].main = true;
            AppState.dailyActivityMap[todayFormatted].skippedWithRestDay = true;
            showMessage('Rest day used! Mission marked as complete.', true);
        } else {
            AppState.completedDays.add(currentChallengeDay);
            AppState.currentStreak++;
            AppState.dailyActivityMap[todayFormatted] = AppState.dailyActivityMap[todayFormatted] || {};
            AppState.dailyActivityMap[todayFormatted].main = true;
            
            // Earn tokens for completing main mission
            AppState.tokens += 1;
            showMessage('Mission complete! You earned 1 Glow Token! ✨', true);
        }

        if (AppState.currentStreak > AppState.bestStreak) {
            AppState.bestStreak = AppState.currentStreak;
        }
        
        saveState();
        checkAchievements(); // Check achievements after state change
        renderDashboard();
        renderCalendar(); // Update calendar colors
    });

    // Close missed reason modal on outside click
    document.getElementById('missed-reason-modal').addEventListener('click', (e) => {
        if (e.target.id === 'missed-reason-modal') {
            hideModal('missed-reason-modal');
        }
    });

    // Submit missed reason
    document.getElementById('submit-missed-reason-btn').addEventListener('click', (e) => {
        const reasonInput = document.getElementById('missed-reason-input');
        const reason = reasonInput.value.trim();
        const dateKey = e.target.dataset.dateKey; 

        if (reason && dateKey) {
            AppState.dailyActivityMap[dateKey] = AppState.dailyActivityMap[dateKey] || {};
            AppState.dailyActivityMap[dateKey].missedReason = reason;
            saveState();
            showMessage('Missed reason recorded.', true);
            hideModal('missed-reason-modal');
            renderDashboard(); // Re-render to ensure streak updates
            renderCalendar(); // Update calendar if needed
        } else {
            showMessage('Please enter a reason.', false);
        }
    });

    // Back buttons for detail views
    document.getElementById('back-to-pillars-btn').addEventListener('click', () => {
        document.getElementById('pillar-detail-view').classList.add('hidden');
        document.getElementById('pillars').classList.remove('hidden');
        updateView('pillars'); // Re-render pillars list to ensure consistency
    });

    document.getElementById('back-to-skills-btn').addEventListener('click', () => {
        document.getElementById('skill-detail-view').classList.add('hidden');
        document.getElementById('skills').classList.remove('hidden');
        updateView('skills'); // Re-render skills list to ensure consistency
    });

    // Daily Schedule buttons
    document.getElementById('weekday-btn').addEventListener('click', () => renderSchedule('weekday'));
    document.getElementById('weekend-btn').addEventListener('click', () => renderSchedule('weekend'));

    // Daily Focus Claim Tokens Button
    document.getElementById('claim-tokens-btn').addEventListener('click', () => {
        if (AppState.dailyFocusCompletedToday) {
            showMessage('You already claimed tokens for today!', false);
            return;
        }
        const allTasksCompleted = AppState.dailyFocusTasks.every(task => task.completed);
        if (allTasksCompleted) {
            let tokensEarned = TOKEN_FOR_DAILY_FOCUS_COMPLETION;
            if (AppState.nextDailyFocusBonus > 0) {
                tokensEarned *= AppState.nextDailyFocusBonus;
                AppState.nextDailyFocusBonus = 0; // Reset bonus after use
                showMessage(`Bonus! You earned ${tokensEarned} Glow Tokens! ✨`, true);
            } else {
                showMessage(`You earned ${tokensEarned} Glow Tokens! ✨`, true);
            }
            AppState.tokens += tokensEarned;
            AppState.dailyFocusCompletedToday = true;
            saveState();
            checkAchievements();
            renderDailyFocus(); // Re-render to update token display and button state
            renderDashboard(); // Update tokens on dashboard as well
        } else {
            showMessage('Please complete all daily focus tasks first!', false);
        }
    });

    // Journal Save Button
    document.getElementById('save-journal-btn').addEventListener('click', () => {
        const journalInput = document.getElementById('journal-input');
        const journalMoodSelect = document.getElementById('journal-mood-select');
        const todayFormatted = formatDate(new Date());

        const content = journalInput.value.trim();
        const mood = journalMoodSelect.value;
        const highlight = AppState.dailyActivityMap[todayFormatted]?.highlight || ''; // Get highlight from daily activity

        if (content || mood || highlight) {
            // Check if an entry for today already exists
            const existingEntryIndex = AppState.journalEntries.findIndex(entry => entry.date === todayFormatted);
            if (existingEntryIndex !== -1) {
                // Update existing entry
                AppState.journalEntries[existingEntryIndex].content = content;
                AppState.journalEntries[existingEntryIndex].mood = mood;
                AppState.journalEntries[existingEntryIndex].highlight = highlight;
                // Tags could be added here if you implement tagging in the future
            } else {
                // Add new entry
                AppState.journalEntries.push({
                    id: generateUUID(),
                    date: todayFormatted,
                    mood: mood,
                    highlight: highlight,
                    content: content,
                    tags: [] // Placeholder for future tagging
                });
            }
            saveState();
            showMessage('Journal entry saved!', true);
            renderFilteredJournalEntries(); // Re-render list
        } else {
            showMessage('Journal entry is empty. Nothing to save.', false);
        }
    });

    // Journal filters
    document.getElementById('journal-filter-date').addEventListener('change', renderFilteredJournalEntries);
    document.getElementById('journal-search-input').addEventListener('input', renderFilteredJournalEntries);
    document.getElementById('clear-journal-filters').addEventListener('click', () => {
        document.getElementById('journal-filter-date').value = '';
        document.getElementById('journal-search-input').value = '';
        renderFilteredJournalEntries();
        showMessage('Journal filters cleared.');
    });

    // Settings Tab Navigation
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active-tab'));
            e.target.classList.add('active-tab');

            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`settings-tab-${e.target.dataset.tab}`).classList.remove('hidden');

            // Re-render relevant sections if they are active
            if (e.target.dataset.tab === 'themes') {
                applyTheme(AppState.theme, false); // Re-apply theme to ensure custom builder visibility is correct
            }
            if (e.target.dataset.tab === 'content') {
                renderUserAffirmations('settings-user-affirmations-list');
                renderSettings(); // Re-render custom pillar/skill lists
            }
        });
    });

    // Settings input change listeners
    document.getElementById('settings-user-name').addEventListener('input', (e) => {
        AppState.userName = e.target.value.trim();
        saveState();
        renderDashboard(); // Update name on dashboard
    });

    document.getElementById('settings-difficulty-select').addEventListener('change', (e) => {
        AppState.difficulty = e.target.value;
        saveState();
        // Potentially adjust daily tasks based on difficulty if desired
        showMessage('Difficulty setting updated.');
    });

    document.getElementById('notification-toggle').addEventListener('change', (e) => {
        AppState.notificationsEnabled = e.target.checked;
        saveState();
        showMessage(`Notifications ${AppState.notificationsEnabled ? 'enabled' : 'disabled'}.`);
    });

    document.getElementById('reduce-motion-toggle').addEventListener('change', (e) => {
        AppState.reduceMotion = e.target.checked;
        saveState();
        applyAccessibilitySettings();
        showMessage(`Reduce motion ${AppState.reduceMotion ? 'enabled' : 'disabled'}.`);
    });

    document.getElementById('settings-theme-select').addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });

    document.getElementById('save-custom-theme-btn').addEventListener('click', saveCustomTheme);

    // Custom theme color inputs
    document.querySelectorAll('#custom-theme-builder .color-input').forEach(input => {
        input.addEventListener('input', () => {
            const propName = `--${input.id.replace('custom-', '')}`;
            document.documentElement.style.setProperty(propName, input.value);
        });
    });

    // Add Affirmation Button (Settings)
    document.getElementById('settings-add-affirmation-btn').addEventListener('click', () => {
        const input = document.getElementById('settings-custom-affirmation-input');
        const affirmation = input.value.trim();
        if (affirmation) {
            AppState.userAffirmations.push(affirmation);
            input.value = '';
            saveState();
            renderUserAffirmations('settings-user-affirmations-list');
            showMessage('Affirmation added to your custom list!');
        } else {
            showMessage('Please enter an affirmation.', false);
        }
    });

    // Custom Pillar/Skill Add/Edit Buttons
    document.getElementById('add-custom-pillar-btn').addEventListener('click', () => showCustomPillarSkillModal('add-pillar'));
    document.getElementById('add-custom-skill-btn').addEventListener('click', () => showCustomPillarSkillModal('add-skill'));

    document.getElementById('cancel-custom-btn').addEventListener('click', () => hideModal('custom-pillar-skill-modal'));

    document.getElementById('save-custom-btn').addEventListener('click', () => {
        const name = document.getElementById('custom-name-input').value.trim();
        const icon = document.getElementById('custom-icon-input').value.trim();
        const content = document.getElementById('custom-content-input').value.trim();
        const tasks = document.getElementById('custom-tasks-input').value.split('\n').map(task => task.trim()).filter(task => task !== '');

        if (!name || !icon || !content || tasks.length === 0) {
            showMessage('Please fill in all fields and add at least one task.', false);
            return;
        }

        const newOrUpdatedEntity = {
            id: customModalEntityId || generateUUID(),
            icon,
            title: name,
            content,
            tasks
        };

        if (customModalMode === 'add-pillar') {
            AppState.customPillars.push(newOrUpdatedEntity);
            pillarsData = [...defaultPillarsData, ...AppState.customPillars]; // Update global reference
            showMessage('Custom Pillar added!');
        } else if (customModalMode === 'edit-pillar') {
            const index = AppState.customPillars.findIndex(p => p.id === customModalEntityId);
            if (index !== -1) AppState.customPillars[index] = newOrUpdatedEntity;
            pillarsData = [...defaultPillarsData, ...AppState.customPillars]; // Update global reference
            showMessage('Custom Pillar updated!');
        } else if (customModalMode === 'add-skill') {
            AppState.customSkills.push(newOrUpdatedEntity);
            skillsData = [...defaultSkillsData, ...AppState.customSkills]; // Update global reference
            showMessage('Custom Skill added!');
        } else if (customModalMode === 'edit-skill') {
            const index = AppState.customSkills.findIndex(s => s.id === customModalEntityId);
            if (index !== -1) AppState.customSkills[index] = newOrUpdatedEntity;
            skillsData = [...defaultSkillsData, ...AppState.customSkills]; // Update global reference
            showMessage('Custom Skill updated!');
        }

        saveState();
        hideModal('custom-pillar-skill-modal');
        renderSettings(); // Re-render settings to show updated lists
    });


    // Data Management
    document.getElementById('export-data-btn').addEventListener('click', () => {
        const dataStr = JSON.stringify(AppState, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `glowup_dashboard_data_${formatDate(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage('Data exported successfully!');
    });

    const importDataInput = document.getElementById('import-data-input');
    const importDataBtn = document.getElementById('import-data-btn');

    if (importDataInput && importDataBtn) {
        importDataInput.addEventListener('change', () => {
            if (importDataInput.files.length > 0) {
                importDataBtn.disabled = false;
            } else {
                importDataBtn.disabled = true;
            }
        });

        importDataBtn.addEventListener('click', () => {
            const file = importDataInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedState = JSON.parse(e.target.result);
                        // Validate importedState structure if necessary before applying
                        if (importedState.isPersonalized !== undefined && importedState.userName !== undefined) {
                            localStorage.setItem('glowUpAppState', JSON.stringify(importedState));
                            location.reload(); // Reload to apply new state
                        } else {
                            showMessage('Invalid data file. Please upload a valid Glow-Up Dashboard JSON.', false);
                        }
                    } catch (error) {
                        showMessage('Error parsing file: ' + error.message, false);
                        console.error('Error importing data:', error);
                    }
                };
                reader.readAsText(file);
            } else {
                showMessage('Please select a file to import.', false);
            }
        });
    }

    document.getElementById('reset-progress-btn').addEventListener('click', () => {
        // Use a custom modal for confirmation instead of alert/confirm
        const confirmReset = document.createElement('div');
        confirmReset.className = 'modal-overlay';
        confirmReset.innerHTML = `
            <div class="card p-6 w-11/12 max-w-sm text-center">
                <h3 class="font-bold text-xl mb-4 text-red-600">Reset All Progress?</h3>
                <p class="text-secondary mb-6">Are you sure you want to reset all your progress? This cannot be undone.</p>
                <div class="flex justify-center space-x-4">
                    <button id="cancel-reset-btn" class="bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors shadow-sm">Cancel</button>
                    <button id="confirm-reset-btn" class="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors shadow-sm">Reset</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmReset);

        document.getElementById('cancel-reset-btn').addEventListener('click', () => {
            document.body.removeChild(confirmReset);
        });

        document.getElementById('confirm-reset-btn').addEventListener('click', () => {
            localStorage.clear();
            location.reload();
        });
    });

    // Quick Actions
    document.getElementById('goto-daily-focus-btn').addEventListener('click', () => updateView('daily-focus'));
    document.getElementById('view-active-goals-btn').addEventListener('click', () => updateView('goals'));
});

