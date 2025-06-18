// script.js kibidii

const TOTAL_CHALLENGE_DAYS = 90;
const TOKEN_FOR_DAILY_FOCUS_COMPLETION = 3; // Tokens gained per daily focus completion
const MAX_DAILY_SKILL_TASKS = 3; // Max number of daily skill tasks to present
const MICRO_CHALLENGE_TOKEN_REWARD = 5; // Tokens for completing a micro-challenge
const QUIZ_TOKEN_REWARD_CORRECT_ANSWER = 2; // Tokens per correct quiz answer

// --- Utility Functions ---

/**
 * Generates a UUID for unique IDs.
 * @returns {string} A unique ID string.
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Formats a Date object to YYYY-MM-DD string (local timezone).
 * @param {Date} date - The date object.
 * @returns {string} Formatted date string.
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calculates the number of full days between two dates.
 * Dates are floored to the start of their day in local timezone.
 * @param {Date} date1
 * @param {Date} date2
 * @returns {number} The number of days.
 */
function getDayDifference(date1, date2) {
    const d1 = new Date(date1);
    d1.setHours(0, 0, 0, 0); // Normalize to start of day
    const d2 = new Date(date2);
    d2.setHours(0, 0, 0, 0); // Normalize to start of day
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculates time until next midnight in local timezone.
 * @returns {number} Milliseconds until midnight.
 */
function getTimeUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Set to next midnight (local time)
    return midnight.getTime() - now.getTime();
}

let countdownInterval;
/** Starts or updates the countdown timer for daily refresh. */
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
            location.reload(); // Reload the page to reset daily tasks
        } else {
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            timerElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

/** Shuffles an array in place. */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- App State Definition ---
const AppState = {
    currentView: 'dashboard',
    userName: null,
    difficulty: 'normal',
    selectedSkills: new Set(),
    isPersonalized: false,
    // startDate is set to the start of the day user completes personalization
    startDate: null,
    // today is calculated dynamically based on startDate and current date
    today: 1, // Represents the current challenge day (1 to 90)
    lastVisitDate: null, // Stores the formatted date of the last visit

    completedDays: new Set(), // Days where main mission was completed
    currentStreak: 0,
    bestStreak: 0,
    dailyActivityMap: {}, // { 'YYYY-MM-DD': { main:bool, focus:bool, mood:str, highlight:str, missedReason:str, skippedWithRestDay:bool }, ... }

    completedSkillTasks: {}, // { skillId: [taskIndex, ...], ... }
    completedPillarTasks: {}, // { pillarId: [taskIndex, ...], ... }
    
    tokens: 0,
    dailyFocusTasks: [], // [{ skillId, taskIndex, taskText, skillIcon, completed }, ...]
    dailyFocusCompletedToday: false,
    lastDailyFocusDate: null,
    nextDailyFocusBonus: 0, // Multiplier for next daily focus tokens
    
    restDaysAvailable: 0,
    microChallenges: [], // [{ id, text, completed, dateCompleted }, ...]
    lastMicroChallengeDate: null, // To ensure one per day
    
    userGoals: {}, // { entityId: [{ id, text, completed }, ...], global: [...] }
    globalGoals: [], // Global goals as a flat array
    
    earnedBadges: new Set(),
    purchasedShopItems: new Set(),
    
    affirmations: [ // Default affirmations
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
    journalEntries: [], // [{ id, date, mood, highlight, content, tags:[] }]
    
    theme: 'light',
    customThemeColors: null, // { --bg-primary: '#...', ... }
    notificationsEnabled: true,
    notificationTime: '08:00', // Default notification time
    reduceMotion: false,
    fontSize: 'medium', // 'small', 'medium', 'large'
    fontFamily: 'Inter', // 'Inter', 'Open Sans Dyslexic', 'Lexend Deca'

    customPillars: [], // [{ id, icon, title, content, tasks }]
    customSkills: [], // [{ id, icon, title, content, tasks }]
    learningResources: [], // [{ id, name, url, associatedEntityId }]
    quizzes: [], // [{ id, name, questions: [{ q, options:[], a, completed:bool }], completed:bool, score:int, dateCompleted }]
};

// --- Static Data (Default Pillars, Skills, Shop, Badges, etc.) ---
// (Moved here for conciseness, same as provided previously, but shortened for example)
const dailyTasks = Array.from({ length: TOTAL_CHALLENGE_DAYS }, (_, i) => {
    const day = i + 1;
    let pillar, task;
    // ... (logic for assigning daily tasks based on day remains the same)
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
        icon: '�',
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
    },
    {
        id: 'badge-unlock',
        name: 'Unlock Random Badge',
        icon: '🎖️',
        description: 'Instantly unlock a random badge you haven\'t earned yet.',
        cost: 75
    },
    {
        id: 'affirmation-pack',
        name: 'Affirmation Pack',
        icon: '💖',
        description: 'Adds 5 new inspiring affirmations to your collection.',
        cost: 10
    }
];

const badgesData = [
    { id: 'consistency-streak-7', name: '7-Day Streak', icon: '🔥', description: 'Completed daily missions for 7 days in a row!', tier: 'bronze' },
    { id: 'consistency-streak-30', name: '30-Day Streak', icon: '🌟', description: 'Maintained consistency for a whole month!', tier: 'silver' },
    { id: 'consistency-streak-90', name: '90-Day Streak', icon: '🏆', description: 'Mastered consistency for the entire challenge!', tier: 'gold' },
    { id: 'halfway-hero', name: 'Halfway Hero', icon: '🏅', description: 'Reached Day 45 of your 90-day challenge!' },
    { id: 'challenge-master', name: 'Challenge Master', icon: '👑', description: 'Completed all 90 days of the challenge!' },
    { id: 'token-tycoon-50', name: 'Token Tycoon (50)', icon: '💰', description: 'Collected 50 Glow Tokens!', tier: 'bronze' },
    { id: 'token-tycoon-100', name: 'Token Tycoon (100)', icon: '💎', description: 'Collected 100 Glow Tokens!', tier: 'silver' },
    { id: 'skill-explorer-5', name: 'Skill Explorer (5)', icon: '🗺️', description: 'Completed 5 tasks across different skills!', tier: 'bronze' },
    { id: 'skill-explorer-10', name: 'Skill Explorer (10)', icon: '🧭', description: 'Completed 10 tasks across different skills!', tier: 'silver' },
    { id: 'pillar-powerhouse-5', name: 'Pillar Powerhouse (5)', icon: '🏛️', description: 'Completed 5 tasks across different pillars!', tier: 'bronze' },
    { id: 'pillar-powerhouse-10', name: 'Pillar Powerhouse (10)', icon: '🏰', description: 'Completed 10 tasks across different pillars!', tier: 'silver' },
    { id: 'goal-getter-first', name: 'First Goal Getter', icon: '🎯', description: 'Completed your first personal goal!', tier: 'bronze' },
    { id: 'goal-getter-5', name: 'Goal Master (5)', icon: '🏆', description: 'Completed 5 personal goals!', tier: 'silver' },
    { id: 'shopaholic', name: 'Shopaholic', icon: '🛍️', description: 'Purchased 3 distinct items from the shop!' },
    { id: 'quiz-master', name: 'Quiz Master', icon: '🧠', description: 'Completed 3 quizzes with a perfect score!' },
    { id: 'journal-keeper', name: 'Journal Keeper', icon: '📓', description: 'Made 10 journal entries.' },
    { id: 'micro-challenge-pro', name: 'Micro-Challenge Pro', icon: '⚡', description: 'Completed 5 micro-challenges.' }
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

const microChallengePool = [
    { id: 'kind-word', text: 'Give a genuine compliment to someone today. 😊' },
    { id: 'tidy-spot', text: 'Clean up one small messy spot in your room. ✨' },
    { id: '5min-stretch', text: 'Do 5 minutes of mindful stretching. 🧘‍♀️' },
    { id: 'hydration-check', text: 'Drink an extra glass of water. 💧' },
    { id: 'quick-read', text: 'Read something for pure enjoyment for 10 minutes. 📚' },
    { id: 'new-song', text: 'Listen to a song from a genre you usually don\'t. 🎶' },
    { id: 'gratitude-thought', text: 'Think of one small thing you are grateful for right now. 🙏' },
    { id: 'posture-check', text: 'Consciously correct your posture three times today. 🚶‍♀️' },
    { id: 'brain-break', text: 'Take a 5-minute break from screens, just look out a window. 🌳' },
    { id: 'help-someone', text: 'Offer a small, unsolicited act of help to a family member. 🤝' }
];

const defaultQuizzes = [
    {
        id: 'healthy-habits-1',
        name: 'Healthy Habits Quiz 1',
        associatedEntityId: 'nourish',
        questions: [
            { q: 'How many glasses of water should you aim for daily?', options: ['2-3', '4-5', '6-8', '10+'], a: '6-8' },
            { q: 'Which is a lean protein source?', options: ['Fried Chicken', 'Tofu', 'Processed Cheese', 'Instant Noodles'], a: 'Tofu' },
            { q: 'What is the best way to start your day for energy?', options: ['Skipping breakfast', 'Sugary cereal', 'Balanced breakfast', 'Coffee only'], a: 'Balanced breakfast' }
        ]
    },
    {
        id: 'mindfulness-basics',
        name: 'Mindfulness Basics Quiz',
        associatedEntityId: 'mind',
        questions: [
            { q: 'What is mindfulness primarily about?', options: ['Thinking about the past', 'Being present', 'Planning the future', 'Ignoring feelings'], a: 'Being present' },
            { q: 'A short breathing exercise can help with:', options: ['Increasing stress', 'Calming down', 'Making you sleepy', 'Making you hungry'], a: 'Calming down' },
            { q: 'What is a "thought" in mindfulness?', options: ['A fact', 'An opinion', 'A passing mental event', 'A command'], a: 'A passing mental event' }
        ]
    }
];

let progressChartInstance = null;
let dailyCompletionChartInstance = null;
let streakHistoryChartInstance = null;
let moodTrendChartInstance = null;

// --- State Management ---
/** Loads the app state from local storage. */
function loadState() {
    const savedState = localStorage.getItem('glowUpAppState');

    if (savedState) {
        const parsedState = JSON.parse(savedState);

        // Iterate and assign properties, ensuring new properties are initialized if missing
        for (const key in AppState) {
            if (parsedState.hasOwnProperty(key)) {
                if (AppState[key] instanceof Set) {
                    AppState[key] = new Set(parsedState[key]);
                } else if (typeof AppState[key] === 'object' && AppState[key] !== null && !Array.isArray(AppState[key])) {
                    // Deep merge for objects like dailyActivityMap, userGoals, completedSkillTasks, completedPillarTasks
                    AppState[key] = { ...AppState[key], ...parsedState[key] };
                } else {
                    AppState[key] = parsedState[key];
                }
            }
        }
        // Special handling for date objects
        AppState.startDate = parsedState.startDate ? new Date(parsedState.startDate) : null;
    }

    // Ensure sets are re-created correctly (if they were stored as arrays)
    AppState.completedDays = new Set(AppState.completedDays);
    AppState.selectedSkills = new Set(AppState.selectedSkills);
    AppState.earnedBadges = new Set(AppState.earnedBadges);
    AppState.purchasedShopItems = new Set(AppState.purchasedShopItems);

    // Initialize dynamic pillar/skill data based on loaded custom data
    pillarsData = [...defaultPillarsData, ...AppState.customPillars];
    skillsData = [...defaultSkillsData, ...AppState.customSkills];

    // --- Day Synchronization Logic ---
    const todayActual = new Date();
    todayActual.setHours(0, 0, 0, 0); // Normalize to start of current local day
    const todayFormatted = formatDate(todayActual);

    // If it's the very first launch OR personalization was just completed
    if (!AppState.isPersonalized || !AppState.startDate) {
        // Personalization menu will handle setting AppState.startDate
        // AppState.today will be 1 until personalization is complete
        AppState.today = 1;
        AppState.lastVisitDate = todayFormatted; // Set last visit to today if first launch
        saveState(); // Save the initial state with proper startDate
    } else {
        // Calculate AppState.today based on startDate and current actual date
        AppState.today = getDayDifference(AppState.startDate, todayActual) + 1;

        // Handle daily reset logic only if it's a new day since last visit
        if (AppState.lastVisitDate !== todayFormatted) {
            const yesterdayFormatted = formatDate(new Date(todayActual.getTime() - (24 * 60 * 60 * 1000)));
            const yesterdayActivity = AppState.dailyActivityMap[yesterdayFormatted];

            // If yesterday's main task was NOT completed AND it wasn't skipped with a rest day, break streak
            if (AppState.today > 1 && (!yesterdayActivity || !yesterdayActivity.main || yesterdayActivity.skippedWithRestDay === false && !yesterdayActivity.main)) {
                if (!(yesterdayActivity && yesterdayActivity.missedReason)) {
                    // Only prompt if a reason hasn't been set
                    showMissedReasonModal(yesterdayFormatted);
                }
                AppState.currentStreak = 0; // Break streak regardless if yesterday was missed
            }

            // Reset daily focus and micro-challenge for the new day
            AppState.dailyFocusCompletedToday = false;
            AppState.dailyFocusTasks = []; // Clear previous daily focus tasks
            AppState.lastDailyFocusDate = todayFormatted; // Update last daily focus generation date

            AppState.lastMicroChallengeDate = todayFormatted; // Update last micro challenge date
            // Note: micro-challenges themselves are in AppState.microChallenges, and we just need to ensure the daily one is set as uncompleted for the new day in renderDailyFocus.
            const todayMicroChallenge = AppState.microChallenges.find(mc => mc.date === todayFormatted);
            if (todayMicroChallenge) {
                todayMicroChallenge.completed = false; // Reset completion status for new day
            }
            
            AppState.lastVisitDate = todayFormatted; // Update last visit date
            saveState();
        }
    }

    applyTheme(AppState.theme, false); // Apply theme on load, don't save again
    applyAccessibilitySettings(); // Apply accessibility settings
    applyFontSettings(); // Apply font settings
}

/** Saves the entire app state to local storage. */
function saveState() {
    const stateToSave = {};
    for (const key in AppState) {
        if (AppState[key] instanceof Set) {
            stateToSave[key] = Array.from(AppState[key]);
        } else if (AppState[key] instanceof Date) {
            stateToSave[key] = AppState[key].toISOString(); // Store Dates as ISO strings
        } else {
            stateToSave[key] = AppState[key];
        }
    }
    localStorage.setItem('glowUpAppState', JSON.stringify(stateToSave));
}

// --- Theme Management ---
/** Applies the selected theme and optionally saves it. */
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
    // These are called in renderAnalytics(), but ensure dashboard chart updates
    if (AppState.currentView === 'dashboard') {
        renderProgressChart();
    } else if (AppState.currentView === 'analytics') {
        renderAnalytics();
    }
}

/** Saves the custom theme colors. */
function saveCustomTheme() {
    const customColors = {};
    const colorInputs = document.querySelectorAll('#custom-theme-builder .color-input');
    colorInputs.forEach(input => {
        const propName = `--${input.id.replace('custom-', '')}`;
        customColors[propName] = input.value;
    });
    AppState.customThemeColors = customColors;
    applyTheme('custom'); // Re-apply theme to pick up new custom colors
    showMessage('Custom theme applied and saved!', true);
}

/** Applies accessibility settings like reduced motion and notification preference. */
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

    const notificationToggle = document.getElementById('notification-toggle');
    const notificationTimeSetting = document.getElementById('notification-time-setting');
    const notificationTimeInput = document.getElementById('notification-time');

    if (notificationToggle) {
        notificationToggle.checked = AppState.notificationsEnabled;
        if (notificationTimeSetting) {
            if (AppState.notificationsEnabled) {
                notificationTimeSetting.classList.remove('hidden');
            } else {
                notificationTimeSetting.classList.add('hidden');
            }
        }
    }
    if (notificationTimeInput) {
        notificationTimeInput.value = AppState.notificationTime;
    }
    // Note: Actual browser notifications require user permission and service workers,
    // which are beyond the scope of a simple local-storage HTML app.
    // This setting mainly controls the UI for notification preference.
}

/** Applies selected font size and family. */
function applyFontSettings() {
    document.documentElement.style.setProperty('font-size', getFontSizeValue(AppState.fontSize));
    document.body.style.fontFamily = `'${AppState.fontFamily}', sans-serif`;

    const fontSizeSelect = document.getElementById('font-size-select');
    const fontFamilySelect = document.getElementById('font-family-select');
    if (fontSizeSelect) fontSizeSelect.value = AppState.fontSize;
    if (fontFamilySelect) fontFamilySelect.value = AppState.fontFamily;
}

/** Maps font size string to CSS value. */
function getFontSizeValue(size) {
    switch (size) {
        case 'small': return '0.875rem'; // 14px
        case 'medium': return '1rem'; // 16px (default)
        case 'large': return '1.125rem'; // 18px
        default: return '1rem';
    }
}

// --- View Management ---
/** Updates the currently displayed view. */
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
        viewId = 'dashboard';
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
        // Ensure the correct schedule is shown if user comes back to this view
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

/** Renders the personalization menu. */
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

/** Renders the user's custom affirmations in a given list element. */
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
                    <span class="text-primary">"${affirmation}"</span>
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
                showMessage('Affirmation removed!', true);
            });
        });
    }
}

/** Renders the main dashboard view. */
async function renderDashboard() {
    const currentChallengeDay = AppState.today > TOTAL_CHALLENGE_DAYS ? TOTAL_CHALLENGE_DAYS : AppState.today;
    const taskForToday = dailyTasks.find(t => t.day === currentChallengeDay) || dailyTasks[dailyTasks.length - 1];

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

    // Clear existing event listeners for mood and highlight to prevent duplicates
    const moodSelect = document.getElementById('mood-select');
    const dailyHighlightInput = document.getElementById('daily-highlight-input');

    // Remove previous listeners if they exist
    if (moodSelect._changeListener) {
        moodSelect.removeEventListener('change', moodSelect._changeListener);
    }
    if (dailyHighlightInput._inputListener) {
        dailyHighlightInput.removeEventListener('input', dailyHighlightInput._inputListener);
    }

    // Define and attach new listeners, storing them for later removal
    moodSelect._changeListener = (e) => {
        AppState.dailyActivityMap[todayFormatted] = AppState.dailyActivityMap[todayFormatted] || {};
        AppState.dailyActivityMap[todayFormatted].mood = e.target.value;
        saveState();
    };
    dailyHighlightInput._inputListener = (e) => {
        AppState.dailyActivityMap[todayFormatted] = AppState.dailyActivityMap[todayFormatted] || {};
        AppState.dailyActivityMap[todayFormatted].highlight = e.target.value;
        saveState();
    };

    moodSelect.addEventListener('change', moodSelect._changeListener);
    dailyHighlightInput.addEventListener('input', dailyHighlightInput._inputListener);

    const streakVisualElement = document.getElementById('current-streak-visual');
    if (streakVisualElement) {
        streakVisualElement.innerHTML = '';
        if (AppState.currentStreak > 0) {
            let fireEmojis = '';
            for (let i = 0; i < Math.min(AppState.currentStreak, 5); i++) { // Limit to 5 emojis
                fireEmojis += '🔥';
            }
            streakVisualElement.textContent = `${fireEmojis} ${AppState.currentStreak}`;
        } else {
            streakVisualElement.textContent = `${AppState.currentStreak}`;
        }
    }

    const upcomingMissionsList = document.getElementById('upcoming-missions-list');
    if (upcomingMissionsList) {
        upcomingMissionsList.innerHTML = '';
        const upcoming = dailyTasks.filter(task => !AppState.completedDays.has(task.day) && task.day > AppState.today).slice(0, 3);

        if (upcoming.length > 0) {
            upcoming.forEach(mission => {
                upcomingMissionsList.innerHTML += `
                    <div class="flex items-center space-x-2">
                        <span class="text-brand-primary font-semibold">Day ${mission.day}:</span>
                        <span class="text-sm text-primary">${mission.task}</span>
                    </div>
                `;
            });
        } else {
            upcomingMissionsList.innerHTML = '<p class="text-sm italic text-secondary">No upcoming missions.</p>';
        }
    }

    renderProgressChart();
    renderInspirationCarousel(); // New: Render inspiration carousel
}

/** Renders the calendar grid. */
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    dailyTasks.forEach(task => {
        const dayEl = document.createElement('div');
        dayEl.dataset.day = task.day;
        dayEl.className = 'day-cell h-20 sm:h-24 flex items-center justify-center font-bold text-xl rounded-lg cursor-pointer transition-all duration-300';
        dayEl.textContent = task.day;

        const cellDate = new Date(AppState.startDate.getTime() + ( (task.day - 1) * 24 * 60 * 60 * 1000) );
        const dayKey = formatDate(cellDate);
        const activity = AppState.dailyActivityMap[dayKey] || { main: false, focus: false };

        let baseClasses = 'bg-secondary shadow-md hover:shadow-xl hover:-translate-y-1 border border-primary';
        if (AppState.completedDays.has(task.day)) {
            if (activity.focus) {
                baseClasses = 'completed-all'; // Use CSS class that maps to theme var
            }
            else {
                baseClasses = 'completed-main'; // Use CSS class that maps to theme var
            }
        } else if (activity.focus && task.day < AppState.today) {
            baseClasses = 'completed-focus'; // Use CSS class that maps to theme var
        }
        else if (task.day < AppState.today) {
            baseClasses = 'missed'; // Use CSS class that maps to theme var
        }
        
        if (task.day === AppState.today) {
            baseClasses += ' ring-2 ring-brand-primary ring-offset-2';
        }
        
        dayEl.classList.add(...baseClasses.split(' '));
        grid.appendChild(dayEl);
    });
}

/** Renders the main pillars grid. */
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
                    <h4 class="font-bold text-xl text-primary">${pillar.title}</h4>
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

/** Displays the detailed view for a single pillar. */
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

    // Remove existing listeners before adding new ones
    tasksContainer.querySelectorAll('.pillar-task-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

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
                showMessage(`Task completed for ${clickedPillarId}!`, true);
            } else {
                showMessage('Task already completed!', false);
            }
        });
    });

    renderGoalsForEntity(pillar.id, 'pillar-goals-list', 'add-pillar-goal-input', 'add-pillar-goal-btn');
}

/** Renders the main skills grid. */
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
                    <h4 class="font-bold text-xl text-primary">${skill.title}</h4>
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

/** Displays the detailed view for a single skill. */
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

    // Remove existing listeners before adding new ones
    tasksContainer.querySelectorAll('.skill-task-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

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
                showMessage(`Task completed for ${clickedSkillId}!`, true);
            } else {
                showMessage('Task already completed!', false);
            }
        });
    });

    renderGoalsForEntity(skill.id, 'skill-goals-list', 'add-skill-goal-input', 'add-skill-goal-btn');
}

/** Renders goals for a specific pillar or skill entity. */
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
                        <span class="goal-text text-primary">${goal.text}</span>
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
            showMessage('Goal added!', true);
        } else {
            showMessage('Please enter a goal!', false);
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
                showMessage('Goal completed! Great job!', true);
            }
        });
    });
}

/** Renders global goals. */
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
                        <span class="goal-text text-primary">${goal.text}</span>
                    </label>
                </div>
            `;
        });
    }

    const addGlobalGoalButton = document.getElementById('add-global-goal-btn');
    const addGlobalGoalInput = document.getElementById('add-global-goal-input');

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
            showMessage('Global Goal added!', true);
        } else {
            showMessage('Please enter a global goal!', false);
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
                showMessage('Global Goal completed! Awesome!', true);
            }
        });
    });
}

/** Renders daily skill focus tasks. */
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
        AppState.dailyFocusTasks = []; // Clear previous tasks

        let availableSkillsForFocus = [];
        if (AppState.selectedSkills.size > 0) {
            availableSkillsForFocus = Array.from(AppState.selectedSkills);
        } else {
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

        shuffleArray(allSkillTasks); // Shuffle all available tasks

        for (let i = 0; i < Math.min(MAX_DAILY_SKILL_TASKS, allSkillTasks.length); i++) {
            const task = allSkillTasks[i];
            AppState.dailyFocusTasks.push({
                skillId: task.skillId,
                taskIndex: task.taskIndex,
                taskText: task.taskText,
                skillIcon: task.skillIcon,
                completed: false
            });
        }
        saveState(); // Save newly generated tasks
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
                        <span class="flex-grow text-primary">${task.taskText}</span>
                    </label>
                </div>
            `;
        });

        const allTasksCompleted = AppState.dailyFocusTasks.every(task => task.completed);
        if (allTasksCompleted && !AppState.dailyFocusCompletedToday) {
            claimTokensBtn.disabled = false;
        } else {
            claimTokensBtn.disabled = true;
        }
    }

    // Remove old listeners to prevent duplicates
    dailyTasksContainer.querySelectorAll('.daily-skill-task-checkbox').forEach(checkbox => {
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
    });

    dailyTasksContainer.querySelectorAll('.daily-skill-task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const taskIndex = parseInt(e.target.dataset.taskIndex);
            if (e.target.checked) {
                AppState.dailyFocusTasks[taskIndex].completed = true;
                e.target.disabled = true;
                saveState();
                renderDailyFocus(); // Re-render to update claim button
            }
        });
    });
}

/** Renders the shop items. */
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
                <h4 class="font-bold text-xl mb-2 text-primary">${item.name}</h4>
                <p class="text-secondary text-sm mb-4">${item.description}</p>
                <p class="font-semibold text-lg mb-4 text-brand-primary">Cost: ${item.cost} ✨ Tokens</p>
                <button data-item-id="${item.id}" class="shop-buy-btn w-full py-2 px-4 rounded-lg font-semibold" ${isDisabled ? 'disabled' : ''}>
                    ${isPurchased ? 'Purchased' : (canAfford ? 'Buy Now' : 'Cannot Afford')}
                </button>
            </div>
        `;
    });

    // Remove existing listeners before adding new ones
    shopItemsGrid.querySelectorAll('.shop-buy-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    shopItemsGrid.querySelectorAll('.shop-buy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemId = e.target.dataset.itemId;
            const item = shopItems.find(i => i.id === itemId);

            if (item && AppState.tokens >= item.cost && !AppState.purchasedShopItems.has(item.id)) {
                AppState.tokens -= item.cost;
                AppState.purchasedShopItems.add(item.id);

                // Apply item effect
                if (itemId === 'rest-day') {
                    AppState.restDaysAvailable++;
                    showMessage(`You gained a rest day! You now have ${AppState.restDaysAvailable}.`, true);
                } else if (itemId === 'instant-tip') {
                    const randomAffirmation = AppState.affirmations[Math.floor(Math.random() * AppState.affirmations.length)];
                    showMessage(`💡 Instant Tip: "${randomAffirmation}"`, true);
                } else if (itemId === 'token-bonus') {
                    AppState.tokens += 5;
                    showMessage('Received 5 bonus tokens!', true);
                } else if (itemId === 'skill-xp-boost') {
                    AppState.nextDailyFocusBonus = 2;
                    showMessage('Your next daily skill focus will earn double tokens!', true);
                } else if (itemId === 'mystery-box') {
                    const rewards = ['5 tokens', '1 rest day', 'random affirmation', 'quiz-pass'];
                    const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
                    let msg = `Mystery Box Revealed: `;
                    if (randomReward.includes('tokens')) {
                        const bonus = parseInt(randomReward.split(' ')[0]);
                        AppState.tokens += bonus;
                        msg += `${bonus} tokens!`;
                    } else if (randomReward.includes('rest day')) {
                        AppState.restDaysAvailable++;
                        msg += `1 rest day!`;
                    } else if (randomReward.includes('affirmation')) {
                        const affirmation = AppState.affirmations[Math.floor(Math.random() * AppState.affirmations.length)];
                        AppState.userAffirmations.push(affirmation); // Add to user affirmations
                        msg += `A new affirmation: "${affirmation}"`;
                    } else if (randomReward.includes('quiz-pass')) {
                        const uncompletedQuizzes = AppState.quizzes.filter(q => !q.completed);
                        if (uncompletedQuizzes.length > 0) {
                            const quizToPass = uncompletedQuizzes[Math.floor(Math.random() * uncompletedQuizzes.length)];
                            quizToPass.completed = true;
                            quizToPass.score = quizToPass.questions.length; // Max score
                            msg += `A free pass for Quiz: "${quizToPass.name}"!`;
                        } else {
                            AppState.tokens += 10; // If no quizzes, give bonus tokens
                            msg += `No uncompleted quizzes, so here are 10 bonus tokens!`;
                        }
                    }
                    showMessage(msg, true);
                } else if (itemId === 'badge-unlock') {
                    const unearnedBadges = badgesData.filter(badge => !AppState.earnedBadges.has(badge.id));
                    if (unearnedBadges.length > 0) {
                        shuffleArray(unearnedBadges);
                        const badgeToUnlock = unearnedBadges[0];
                        AppState.earnedBadges.add(badgeToUnlock.id);
                        showMessage(`You unlocked the badge: "${badgeToUnlock.name}"! 🎖️`, true);
                    } else {
                        AppState.tokens += 20; // Refund if no badges to unlock
                        showMessage('No unearned badges, so here are 20 bonus tokens!', true);
                    }
                } else if (itemId === 'affirmation-pack') {
                    const newAffirmations = [
                        "I am growing and improving every day.",
                        "My efforts today create my success tomorrow.",
                        "I am resilient, capable, and strong.",
                        "Every challenge is an opportunity to learn.",
                        "I choose joy and positivity."
                    ];
                    shuffleArray(newAffirmations);
                    for(let i=0; i<Math.min(5, newAffirmations.length); i++) {
                        AppState.userAffirmations.push(newAffirmations[i]);
                    }
                    showMessage(`You added 5 new affirmations to your collection!`, true);
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

/** Renders earned badges. */
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
            <div class="badge-card ${isEarned ? 'earned' : 'locked'} ${badge.tier || ''}">
                <span class="badge-icon">${badge.icon}</span>
                <h4 class="font-bold text-lg mb-1 text-primary">${badge.name}</h4>
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

/** Renders the daily schedule. */
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
        weekendBtn.classList.remove('bg-slate-200', 'text-white');
        weekdayBtn.classList.remove('bg-amber-500', 'text-white');
        weekdayBtn.classList.add('bg-slate-200', 'text-slate-600');
    }
}

/** Renders the journal entries and current day's journal form. */
async function renderJournal() {
    const journalInput = document.getElementById('journal-input');
    const journalMoodSelect = document.getElementById('journal-mood-select');
    const journalTagsInput = document.getElementById('journal-tags-input'); // New
    const journalPromptElement = document.getElementById('journal-prompt');
    const todayFormatted = formatDate(new Date());

    if (!journalInput || !journalMoodSelect || !journalTagsInput || !journalPromptElement) return;

    // Set today's prompt (randomly selected from prompts array)
    journalPromptElement.textContent = journalPrompts[Math.floor(Math.random() * journalPrompts.length)];

    // Load today's journal entry if it exists
    const todayEntry = AppState.journalEntries.find(entry => entry.date === todayFormatted);
    if (todayEntry) {
        journalInput.value = todayEntry.content || '';
        journalMoodSelect.value = todayEntry.mood || '';
        journalTagsInput.value = todayEntry.tags ? todayEntry.tags.join(', ') : ''; // Display tags
    } else {
        journalInput.value = '';
        journalMoodSelect.value = '';
        journalTagsInput.value = '';
    }

    renderFilteredJournalEntries(); // Render past entries
}

/** Filters and renders journal entries based on date and search term. */
function renderFilteredJournalEntries() {
    const journalEntriesList = document.getElementById('journal-entries-list');
    const filterDate = document.getElementById('journal-filter-date').value;
    const searchTerm = document.getElementById('journal-search-input').value.toLowerCase();

    if (!journalEntriesList) return;

    journalEntriesList.innerHTML = '';
    const filteredEntries = AppState.journalEntries.filter(entry => {
        const matchesDate = !filterDate || entry.date === filterDate;
        const matchesSearch = !searchTerm ||
                              (entry.content && entry.content.toLowerCase().includes(searchTerm)) ||
                              (entry.mood && entry.mood.toLowerCase().includes(searchTerm)) ||
                              (entry.highlight && entry.highlight.toLowerCase().includes(searchTerm)) ||
                              (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
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
                    ${entry.tags && entry.tags.length > 0 ? `<div class="text-xs text-secondary italic mt-2">Tags: ${entry.tags.map(tag => `<span class="bg-gray-200 rounded-full px-2 py-1 mr-1">#${tag}</span>`).join('')}</div>` : ''}
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
                checkAchievements(); // Journal count might change
                showMessage('Journal entry deleted!', true);
            });
        });
    }
}

/** Renders analytics overview with charts and progress displays. */
function renderAnalytics() {
    renderDailyCompletionChart();
    renderStreakHistoryChart();
    renderMoodTrendChart();
    renderPillarsSkillsProgress();
    renderGoalProgressOverview();
    renderAchievementsOverview();
}

/** Gets theme-dependent chart colors. */
function getChartColors() {
    const style = getComputedStyle(document.body);
    return {
        primary: style.getPropertyValue('--brand-primary').trim(),
        secondary: style.getPropertyValue('--brand-secondary').trim(),
        textPrimary: style.getPropertyValue('--text-primary').trim(),
        textSecondary: style.getPropertyValue('--text-secondary').trim(),
        bgSecondary: style.getPropertyValue('--bg-secondary').trim(),
        borderPrimary: style.getPropertyValue('--border-primary').trim(),
        completedDayBg: style.getPropertyValue('--completed-day-bg').trim(),
        missedDayBg: style.getPropertyValue('--missed-day-bg').trim()
    };
}

/** Renders the overall progress doughnut chart. */
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
    const currentDayStatus = AppState.completedDays.has(AppState.today) ? 0 : 1; // 1 if current day is not yet completed
    const remainingDaysCount = Math.max(0, TOTAL_CHALLENGE_DAYS - completedCount - currentDayStatus);

    const progressPercentage = TOTAL_CHALLENGE_DAYS > 0 ? Math.round((completedCount / TOTAL_CHALLENGE_DAYS) * 100) : 0;

    let message = '';
    if (completedCount >= TOTAL_CHALLENGE_DAYS) { // Check completedCount against total days
        message = 'You\'ve completed the entire 90-Day Challenge! Amazing!';
    } else {
        message = `You are ${progressPercentage}% through your journey! Keep pushing!`;
    }
    document.getElementById('progress-message').textContent = message;

    progressChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Current Day', 'Remaining'],
            datasets: [{
                data: [completedCount, currentDayStatus, remainingDaysCount],
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

/** Renders the daily completion bar chart. */
function renderDailyCompletionChart() {
    const ctx = document.getElementById('dailyCompletionChart');
    if (!ctx) return;
    const { primary, textSecondary, bgSecondary, borderPrimary, missedDayBg } = getChartColors();

    if (dailyCompletionChartInstance) {
        dailyCompletionChartInstance.destroy();
    }

    const labels = [];
    const completionData = [];
    const missedData = [];

    const todayActual = new Date();
    todayActual.setHours(0,0,0,0);

    for (let i = 1; i <= AppState.today; i++) {
        const dayDate = new Date(AppState.startDate.getTime() + ((i - 1) * 24 * 60 * 60 * 1000));
        const dayFormatted = formatDate(dayDate);
        labels.push(`Day ${i}`);

        const activity = AppState.dailyActivityMap[dayFormatted] || { main: false };
        if (activity.main) {
            completionData.push(1);
            missedData.push(0);
        } else if (i < AppState.today) {
            completionData.push(0);
            missedData.push(1);
        } else {
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
                    backgroundColor: missedDayBg,
                    borderColor: missedDayBg,
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
                            return value === 1 ? 'Day' : '';
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
                            return null;
                        }
                    },
                    bodyFont: { family: 'Inter' },
                    titleFont: { family: 'Inter' }
                }
            }
        }
    });
}

/** Renders the streak history line chart. */
function renderStreakHistoryChart() {
    const ctx = document.getElementById('streakHistoryChart');
    if (!ctx) return;
    const { primary, textSecondary, borderPrimary } = getChartColors();

    if (streakHistoryChartInstance) {
        streakHistoryChartInstance.destroy();
    }

    const labels = [];
    const streakData = [];

    let currentSimulatedStreak = 0;
    const todayActual = new Date();
    todayActual.setHours(0,0,0,0);

    for (let i = 1; i <= AppState.today; i++) {
        const dayDate = new Date(AppState.startDate.getTime() + ((i - 1) * 24 * 60 * 60 * 1000));
        const dayFormatted = formatDate(dayDate);
        labels.push(`Day ${i}`);

        const activity = AppState.dailyActivityMap[dayFormatted] || { main: false };
        if (activity.main) {
            currentSimulatedStreak++;
        } else if (i < AppState.today) {
            currentSimulatedStreak = 0;
        }
        if (i === AppState.today) {
            streakData.push(AppState.currentStreak);
        } else {
            streakData.push(currentSimulatedStreak);
        }
    }

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
                        maxTicksLimit: 10
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
                        precision: 0
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

/** Renders the mood trend line chart. */
function renderMoodTrendChart() {
    const ctx = document.getElementById('moodTrendChart');
    if (!ctx) return;
    const { primary, textSecondary, borderPrimary } = getChartColors();

    if (moodTrendChartInstance) {
        moodTrendChartInstance.destroy();
    }

    const labels = [];
    const moodData = [];
    const moodMap = {
        '😃': 5, '😊': 4, '😐': 3, '😔': 2, '😡': 1
    };

    const todayActual = new Date();
    todayActual.setHours(0,0,0,0);

    for (let i = 1; i <= AppState.today; i++) {
        const dayDate = new Date(AppState.startDate.getTime() + ((i - 1) * 24 * 60 * 60 * 1000));
        const dayFormatted = formatDate(dayDate);
        labels.push(`Day ${i}`);

        const activity = AppState.dailyActivityMap[dayFormatted] || { mood: '' };
        moodData.push(moodMap[activity.mood] || null);
    }

    moodTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Mood',
                data: moodData,
                borderColor: primary,
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
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
                        callback: function(value) {
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

/** Renders progress for all pillars and skills. */
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
            <div class="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-200" style="background-color: var(--bg-primary); border-color: var(--border-primary);">
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
            <div class="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-200" style="background-color: var(--bg-primary); border-color: var(--border-primary);">
                <span class="flex items-center">
                    <span class="text-xl mr-2">${skill.icon}</span>
                    <span class="font-medium text-primary">${skill.title}:</span>
                </span>
                <span class="font-semibold text-brand-primary">${progress}%</span>
            </div>
        `;
    });
}

/** Renders overview of all goals (global and entity-specific). */
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
                <div class="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-200 ${goal.completed ? 'completed' : ''}" style="background-color: var(--bg-primary); border-color: var(--border-primary);">
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
        if (entityId === 'global') continue;

        const entityGoals = AppState.userGoals[entityId];
        if (entityGoals.length > 0) {
            hasEntityGoals = true;
            const entity = pillarsData.find(p => p.id === entityId) || skillsData.find(s => s.id === entityId);
            const entityTitle = entity ? entity.title : `Unknown Entity (${entityId})`;

            entityGoalsList.innerHTML += `<p class="font-semibold text-sm text-secondary mt-4 mb-2">${entityTitle}:</p>`;
            entityGoals.forEach(goal => {
                entityGoalsList.innerHTML += `
                    <div class="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-200 ${goal.completed ? 'completed' : ''}" style="background-color: var(--bg-primary); border-color: var(--border-primary);">
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

/** Renders overview of earned achievements. */
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
                <div class="card p-4 flex items-center space-x-3 bg-green-50 border-green-200" style="background-color: var(--completed-day-bg); border-color: var(--completed-day-text);">
                    <span class="text-3xl">${badge.icon}</span>
                    <div>
                        <h4 class="font-bold text-md text-primary">${badge.name}</h4>
                        <p class="text-sm text-secondary">Earned!</p>
                    </div>
                </div>
            `;
        }
    });

    if (earnedCount === 0) {
        container.innerHTML = '<p class="text-sm italic text-secondary col-span-full">No achievements earned yet. Keep up the great work!</p>';
    }
}

/** Renders the settings view. */
function renderSettings() {
    document.getElementById('settings-user-name').value = AppState.userName || '';
    document.getElementById('settings-difficulty-select').value = AppState.difficulty;
    document.getElementById('notification-toggle').checked = AppState.notificationsEnabled;
    document.getElementById('reduce-motion-toggle').checked = AppState.reduceMotion;
    document.getElementById('settings-theme-select').value = AppState.theme;
    document.getElementById('notification-time').value = AppState.notificationTime;
    document.getElementById('font-size-select').value = AppState.fontSize;
    document.getElementById('font-family-select').value = AppState.fontFamily;

    // Show/hide notification time setting
    const notificationTimeSetting = document.getElementById('notification-time-setting');
    if (AppState.notificationsEnabled) {
        notificationTimeSetting.classList.remove('hidden');
    } else {
        notificationTimeSetting.classList.add('hidden');
    }

    renderUserAffirmations('settings-user-affirmations-list');
    renderCustomPillarsInSettings();
    renderCustomSkillsInSettings();
    renderLearningResourcesInSettings();
    renderQuizzesInSettings();

    const settingsThemeSelect = document.getElementById('settings-theme-select');
    if (settingsThemeSelect && settingsThemeSelect.value === 'custom') {
        document.getElementById('custom-theme-builder').classList.remove('hidden');
    } else {
        document.getElementById('custom-theme-builder').classList.add('hidden');
    }
}

/** Helper to render custom pillars in settings. */
function renderCustomPillarsInSettings() {
    const customPillarsList = document.getElementById('settings-custom-pillars-list');
    if (!customPillarsList) return;
    customPillarsList.innerHTML = '';
    if (AppState.customPillars.length === 0) {
        customPillarsList.innerHTML = '<p class="text-secondary italic text-sm">No custom pillars added yet.</p>';
    } else {
        AppState.customPillars.forEach((pillar, index) => {
            customPillarsList.innerHTML += `
                <div class="flex items-center justify-between bg-gray-100 p-2 rounded-md" style="background-color: var(--bg-primary); border-color: var(--border-primary);">
                    <span class="flex items-center text-primary"><span class="text-xl mr-2">${pillar.icon}</span> ${pillar.title}</span>
                    <div>
                        <button data-id="${pillar.id}" class="edit-custom-pillar-btn text-blue-500 hover:text-blue-700 mr-2">Edit</button>
                        <button data-id="${pillar.id}" class="remove-custom-pillar-btn text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
                    </div>
                </div>
            `;
        });
        customPillarsList.querySelectorAll('.remove-custom-pillar-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idToRemove = e.target.dataset.id;
                AppState.customPillars = AppState.customPillars.filter(p => p.id !== idToRemove);
                pillarsData = [...defaultPillarsData, ...AppState.customPillars];
                saveState();
                renderSettings();
                showMessage('Custom Pillar removed!', true);
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

/** Helper to render custom skills in settings. */
function renderCustomSkillsInSettings() {
    const customSkillsList = document.getElementById('settings-custom-skills-list');
    if (!customSkillsList) return;
    customSkillsList.innerHTML = '';
    if (AppState.customSkills.length === 0) {
        customSkillsList.innerHTML = '<p class="text-secondary italic text-sm">No custom skills added yet.</p>';
    } else {
        AppState.customSkills.forEach((skill, index) => {
            customSkillsList.innerHTML += `
                <div class="flex items-center justify-between bg-gray-100 p-2 rounded-md" style="background-color: var(--bg-primary); border-color: var(--border-primary);">
                    <span class="flex items-center text-primary"><span class="text-xl mr-2">${skill.icon}</span> ${skill.title}</span>
                    <div>
                        <button data-id="${skill.id}" class="edit-custom-skill-btn text-blue-500 hover:text-blue-700 mr-2">Edit</button>
                        <button data-id="${skill.id}" class="remove-custom-skill-btn text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
                    </div>
                </div>
            `;
        });
        customSkillsList.querySelectorAll('.remove-custom-skill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idToRemove = e.target.dataset.id;
                AppState.customSkills = AppState.customSkills.filter(s => s.id !== idToRemove);
                skillsData = [...defaultSkillsData, ...AppState.customSkills];
                saveState();
                renderSettings();
                showMessage('Custom Skill removed!', true);
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

/** Helper to render learning resources in settings. */
function renderLearningResourcesInSettings() {
    const list = document.getElementById('settings-learning-resources-list');
    if (!list) return;
    list.innerHTML = '';
    if (AppState.learningResources.length === 0) {
        list.innerHTML = '<p class="text-secondary italic text-sm">No learning resources added yet.</p>';
    } else {
        AppState.learningResources.forEach(resource => {
            const entity = pillarsData.find(p => p.id === resource.associatedEntityId) || skillsData.find(s => s.id === resource.associatedEntityId);
            const entityTitle = entity ? entity.title : 'N/A';
            list.innerHTML += `
                <div style="background-color: var(--bg-primary); border-color: var(--border-primary);">
                    <div class="flex flex-col flex-grow">
                        <a href="${resource.url}" target="_blank" class="font-semibold text-primary">${resource.name}</a>
                        <span class="text-xs text-secondary">(${entityTitle})</span>
                    </div>
                    <button data-id="${resource.id}" class="remove-resource-btn text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
                </div>
            `;
        });
        list.querySelectorAll('.remove-resource-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idToRemove = e.target.dataset.id;
                AppState.learningResources = AppState.learningResources.filter(r => r.id !== idToRemove);
                saveState();
                renderLearningResourcesInSettings();
                showMessage('Learning resource removed!', true);
            });
        });
    }
}

/** Helper to render quizzes in settings. */
function renderQuizzesInSettings() {
    const list = document.getElementById('settings-quizzes-list');
    if (!list) return;
    list.innerHTML = '';
    if (AppState.quizzes.length === 0) {
        list.innerHTML = '<p class="text-secondary italic text-sm">No quizzes created yet.</p>';
    } else {
        AppState.quizzes.forEach(quiz => {
            list.innerHTML += `
                <div style="background-color: var(--bg-primary); border-color: var(--border-primary);">
                    <div class="flex flex-col flex-grow">
                        <span class="font-semibold text-primary">${quiz.name}</span>
                        <span class="text-xs text-secondary">${quiz.questions.length} Questions</span>
                    </div>
                    <div>
                        <button data-id="${quiz.id}" class="edit-quiz-btn text-blue-500 hover:text-blue-700 mr-2">Edit</button>
                        <button data-id="${quiz.id}" class="remove-quiz-btn text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
                    </div>
                </div>
            `;
        });
        list.querySelectorAll('.remove-quiz-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idToRemove = e.target.dataset.id;
                AppState.quizzes = AppState.quizzes.filter(q => q.id !== idToRemove);
                saveState();
                renderQuizzesInSettings();
                showMessage('Quiz removed!', true);
            });
        });
        list.querySelectorAll('.edit-quiz-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idToEdit = e.target.dataset.id;
                showQuizModal('edit-quiz', idToEdit);
            });
        });
    }
}

/** Renders the inspirational quote carousel. */
function renderInspirationCarousel() {
    const carousel = document.getElementById('inspiration-carousel');
    const authorElement = document.getElementById('quote-author');
    if (!carousel || !authorElement) return;

    const quotes = [
        { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
        { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
        { text: "Your present circumstances don't determine where you can go; they merely determine where you start.", author: "Nido Qubein" },
        { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
        { text: "Success is not final, failure is not fatal: It is the courage to continue that counts.", author: "Winston S. Churchill" },
        { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
        { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
        { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" }
    ];

    shuffleArray(quotes);
    const selectedQuote = quotes[0];

    carousel.textContent = `"${selectedQuote.text}"`;
    authorElement.textContent = `- ${selectedQuote.author}`;
}

// --- Modals and Messages ---

/** Displays a temporary message box. */
function showMessage(message, isSuccess = true) {
    const msgBox = document.getElementById('message-box');
    if (!msgBox) return;

    msgBox.textContent = message;
    msgBox.style.backgroundColor = isSuccess ? 'var(--brand-primary)' : 'rgb(239, 68, 68)';
    msgBox.style.color = 'white'; // Always white text for messages

    msgBox.style.transform = 'translateY(0)';
    msgBox.style.opacity = '1';

    setTimeout(() => {
        msgBox.style.transform = 'translateY(20px)';
        msgBox.style.opacity = '0';
    }, 3000);
}

/** Shows a specific modal by ID. */
function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

/** Hides a specific modal by ID. */
function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

/** Shows the modal to record a missed day reason. */
function showMissedReasonModal(dateKey) {
    const modal = document.getElementById('missed-reason-modal');
    if (!modal) return;
    document.getElementById('submit-missed-reason-btn').dataset.dateKey = dateKey;
    showModal('missed-reason-modal');
}

let customModalMode = ''; // 'add-pillar', 'edit-pillar', 'add-skill', 'edit-skill'
let customModalEntityId = null; // For editing mode

/** Shows the modal for adding/editing custom pillars or skills. */
function showCustomPillarSkillModal(mode, entityId = null) {
    customModalMode = mode;
    customModalEntityId = entityId;

    const modalTitle = document.getElementById('custom-modal-title');
    const nameInput = document.getElementById('custom-name-input');
    const iconInput = document.getElementById('custom-icon-input');
    const contentInput = document.getElementById('custom-content-input');
    const tasksInput = document.getElementById('custom-tasks-input');

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

let currentQuiz = null; // Stores the current quiz being displayed
let currentQuizScore = 0; // Stores the score for the current attempt

/** Shows the quiz modal for taking or editing quizzes. */
function showQuizModal(mode, quizId = null) {
    const modal = document.getElementById('quiz-modal');
    const title = document.getElementById('quiz-modal-title');
    const questionsContainer = document.getElementById('quiz-questions-container');
    const resultContainer = document.getElementById('quiz-result-container');
    const submitBtn = document.getElementById('submit-quiz-btn');
    const closeBtn = document.getElementById('close-quiz-btn');

    // Clear previous state
    questionsContainer.innerHTML = '';
    resultContainer.classList.add('hidden');
    submitBtn.classList.remove('hidden');
    submitBtn.disabled = false;
    closeBtn.classList.add('hidden');
    currentQuiz = null;
    currentQuizScore = 0;

    if (mode === 'take-quiz' && quizId) {
        const quiz = AppState.quizzes.find(q => q.id === quizId);
        if (!quiz) { showMessage('Quiz not found!', false); return; }
        currentQuiz = JSON.parse(JSON.stringify(quiz)); // Deep copy to modify
        title.textContent = currentQuiz.name;

        currentQuiz.questions.forEach((qData, qIndex) => {
            questionsContainer.innerHTML += `
                <div class="mb-4">
                    <p class="font-semibold text-primary mb-2">${qIndex + 1}. ${qData.q}</p>
                    <div class="space-y-2">
                        ${qData.options.map((option, oIndex) => `
                            <label class="flex items-center text-secondary">
                                <input type="radio" name="question-${qIndex}" value="${option}" class="mr-2 accent-brand-primary">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        showModal('quiz-modal');

    } else if (mode === 'create-quiz') {
        title.textContent = 'Create New Quiz';
        // Simplified input for quiz creation - add questions one by one
        questionsContainer.innerHTML = `
            <div class="mb-4">
                <label for="new-quiz-name" class="block font-semibold mb-2 text-primary">Quiz Title:</label>
                <input type="text" id="new-quiz-name" placeholder="e.g., Nutrition Basics" class="w-full p-2 border rounded-md mb-3">
            </div>
            <div id="quiz-question-builder" class="space-y-4 mb-4">
                <p class="text-secondary italic">Add your questions below.</p>
            </div>
            <button id="add-quiz-question-btn" class="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-blue-600 transition-colors">Add Question</button>
        `;
        submitBtn.textContent = 'Save Quiz';
        submitBtn.classList.remove('hidden');
        closeBtn.classList.remove('hidden'); // Allow closing quiz creator

        document.getElementById('add-quiz-question-btn').addEventListener('click', addQuizQuestionToBuilder);
        showModal('quiz-modal');

    } else if (mode === 'edit-quiz' && quizId) {
        title.textContent = 'Edit Quiz';
        const quizToEdit = AppState.quizzes.find(q => q.id === quizId);
        if (!quizToEdit) { showMessage('Quiz not found!', false); return; }
        currentQuiz = JSON.parse(JSON.stringify(quizToEdit)); // Deep copy for editing

        questionsContainer.innerHTML = `
            <div class="mb-4">
                <label for="new-quiz-name" class="block font-semibold mb-2 text-primary">Quiz Title:</label>
                <input type="text" id="new-quiz-name" value="${currentQuiz.name}" class="w-full p-2 border rounded-md mb-3">
            </div>
            <div id="quiz-question-builder" class="space-y-4 mb-4"></div>
            <button id="add-quiz-question-btn" class="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-blue-600 transition-colors">Add Question</button>
        `;
        submitBtn.textContent = 'Save Changes';
        submitBtn.classList.remove('hidden');
        closeBtn.classList.remove('hidden');

        currentQuiz.questions.forEach((qData, qIndex) => addQuizQuestionToBuilder(qData, qIndex));
        document.getElementById('add-quiz-question-btn').addEventListener('click', addQuizQuestionToBuilder);
        showModal('quiz-modal');
    }

    // Common listeners for quiz modal
    // Remove old listeners before adding new ones
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    newSubmitBtn.addEventListener('click', () => {
        if (mode === 'take-quiz') {
            submitQuizAttempt();
        } else if (mode === 'create-quiz' || mode === 'edit-quiz') {
            saveQuizFromBuilder(quizId);
        }
    });
    newCloseBtn.addEventListener('click', () => hideModal('quiz-modal'));
}

/** Adds a question input block to the quiz builder modal. */
function addQuizQuestionToBuilder(questionData = null, index = null) {
    const builder = document.getElementById('quiz-question-builder');
    const qId = index !== null ? index : builder.children.length; // Use index or new number

    const questionDiv = document.createElement('div');
    questionDiv.className = 'border p-3 rounded-md bg-gray-50 relative';
    questionDiv.innerHTML = `
        <button class="remove-quiz-question-btn absolute top-2 right-2 text-red-500 hover:text-red-700 text-xl leading-none">&times;</button>
        <label for="q-${qId}" class="block font-semibold mb-1 text-primary">Question ${qId + 1}:</label>
        <input type="text" id="q-${qId}" class="w-full p-2 border rounded-md mb-2" placeholder="e.g., What is the capital of Philippines?" value="${questionData ? questionData.q : ''}">

        <label class="block font-semibold mb-1 text-primary">Options (one per line):</label>
        <textarea id="options-${qId}" rows="3" class="w-full p-2 border rounded-md mb-2" placeholder="Option 1&#10;Option 2&#10;Option 3">${questionData && questionData.options ? questionData.options.join('\n') : ''}</textarea>

        <label for="a-${qId}" class="block font-semibold mb-1 text-primary">Correct Answer:</label>
        <input type="text" id="a-${qId}" class="w-full p-2 border rounded-md" placeholder="Must match one of the options" value="${questionData ? questionData.a : ''}">
    `;
    builder.appendChild(questionDiv);

    questionDiv.querySelector('.remove-quiz-question-btn').addEventListener('click', (e) => {
        e.target.closest('.border').remove();
    });
}

/** Submits a quiz attempt and shows results. */
function submitQuizAttempt() {
    if (!currentQuiz) return;

    let correctAnswers = 0;
    const questionsCount = currentQuiz.questions.length;

    currentQuiz.questions.forEach((qData, qIndex) => {
        const selectedOption = document.querySelector(`input[name="question-${qIndex}"]:checked`);
        if (selectedOption && selectedOption.value === qData.a) {
            correctAnswers++;
        }
    });

    currentQuizScore = correctAnswers;
    const scoreElement = document.getElementById('quiz-score');
    const feedbackElement = document.getElementById('quiz-feedback');
    const resultContainer = document.getElementById('quiz-result-container');
    const submitBtn = document.getElementById('submit-quiz-btn');
    const closeBtn = document.getElementById('close-quiz-btn');

    scoreElement.textContent = `You scored ${correctAnswers} out of ${questionsCount}!`;
    if (correctAnswers === questionsCount) {
        feedbackElement.textContent = 'Excellent! You got all of them right! 🎉';
        scoreElement.style.color = 'var(--completed-day-text)';
        AppState.tokens += QUIZ_TOKEN_REWARD_CORRECT_ANSWER * questionsCount;
        showMessage(`Quiz complete! Earned ${QUIZ_TOKEN_REWARD_CORRECT_ANSWER * questionsCount} tokens!`, true);
        currentQuiz.completed = true; // Mark as completed
        currentQuiz.score = correctAnswers;
        currentQuiz.dateCompleted = formatDate(new Date());

    } else if (correctAnswers > questionsCount / 2) {
        feedbackElement.textContent = 'Great job! Keep learning. 👍';
        scoreElement.style.color = 'var(--brand-primary)';
        AppState.tokens += QUIZ_TOKEN_REWARD_CORRECT_ANSWER * correctAnswers;
        showMessage(`Quiz complete! Earned ${QUIZ_TOKEN_REWARD_CORRECT_ANSWER * correctAnswers} tokens!`, true);
        currentQuiz.completed = true;
        currentQuiz.score = correctAnswers;
        currentQuiz.dateCompleted = formatDate(new Date());
    } else {
        feedbackElement.textContent = 'Good effort! Review the material and try again. 💪';
        scoreElement.style.color = 'var(--missed-day-text)';
        showMessage('Quiz complete. Try again for more tokens!', false);
        currentQuiz.completed = false; // Not fully completed for rewards/badges
        currentQuiz.score = correctAnswers;
        currentQuiz.dateCompleted = formatDate(new Date());
    }

    resultContainer.classList.remove('hidden');
    submitBtn.classList.add('hidden');
    closeBtn.classList.remove('hidden');

    // Update the original quiz in AppState
    const originalQuizIndex = AppState.quizzes.findIndex(q => q.id === currentQuiz.id);
    if (originalQuizIndex !== -1) {
        AppState.quizzes[originalQuizIndex] = currentQuiz;
    } else {
        // This should not happen if currentQuiz is from AppState, but as a fallback
        AppState.quizzes.push(currentQuiz);
    }
    saveState();
    checkAchievements();
    renderDailyFocus(); // Update token count
}

/** Saves a new or edited quiz from the builder. */
function saveQuizFromBuilder(existingQuizId = null) {
    const quizName = document.getElementById('new-quiz-name').value.trim();
    if (!quizName) {
        showMessage('Please enter a quiz title!', false);
        return;
    }

    const questions = [];
    const questionBlocks = document.querySelectorAll('#quiz-question-builder > div');
    let allValid = true;

    questionBlocks.forEach((block, index) => {
        const qInput = block.querySelector(`input[id="q-${index}"]`);
        const optionsInput = block.querySelector(`textarea[id="options-${index}"]`);
        const aInput = block.querySelector(`input[id="a-${index}"]`);

        const q = qInput.value.trim();
        const options = optionsInput.value.split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
        const a = aInput.value.trim();

        if (!q || options.length < 2 || !a || !options.includes(a)) {
            allValid = false;
            showMessage(`Question ${index + 1} is incomplete or has invalid options/answer.`, false);
            return;
        }
        questions.push({ q, options, a });
    });

    if (!allValid || questions.length === 0) {
        showMessage('Please ensure all questions are complete and have at least 2 options, and the correct answer matches an option.', false);
        return;
    }

    if (existingQuizId) {
        const index = AppState.quizzes.findIndex(q => q.id === existingQuizId);
        if (index !== -1) {
            AppState.quizzes[index].name = quizName;
            AppState.quizzes[index].questions = questions;
            AppState.quizzes[index].completed = false; // Reset completion on edit
            AppState.quizzes[index].score = 0;
            AppState.quizzes[index].dateCompleted = null;
            showMessage('Quiz updated successfully!', true);
        }
    } else {
        AppState.quizzes.push({
            id: generateUUID(),
            name: quizName,
            questions: questions,
            completed: false,
            score: 0,
            dateCompleted: null
        });
        showMessage('New quiz created successfully!', true);
    }
    saveState();
    hideModal('quiz-modal');
    renderQuizzesInSettings();
}

/** Shows the modal for adding/editing learning resources. */
function showLearningResourceModal(mode, resourceId = null) {
    const modal = document.getElementById('learning-resource-modal');
    const title = document.getElementById('resource-modal-title');
    const nameInput = document.getElementById('resource-name-input');
    const urlInput = document.getElementById('resource-url-input');
    const pillarSelect = document.getElementById('resource-pillar-select');
    const saveBtn = document.getElementById('save-resource-btn');

    // Populate pillar/skill select
    pillarSelect.innerHTML = '<option value="">-- Select Pillar/Skill --</option>';
    pillarsData.forEach(p => {
        pillarSelect.innerHTML += `<option value="${p.id}">${p.icon} ${p.title} (Pillar)</option>`;
    });
    skillsData.forEach(s => {
        pillarSelect.innerHTML += `<option value="${s.id}">${s.icon} ${s.title} (Skill)</option>`;
    });

    // Reset form fields
    nameInput.value = '';
    urlInput.value = '';
    pillarSelect.value = '';

    if (mode === 'add-resource') {
        title.textContent = 'Add New Learning Resource';
        saveBtn.textContent = 'Save Resource';
    } else if (mode === 'edit-resource' && resourceId) {
        title.textContent = 'Edit Learning Resource';
        saveBtn.textContent = 'Save Changes';
        const resource = AppState.learningResources.find(r => r.id === resourceId);
        if (resource) {
            nameInput.value = resource.name;
            urlInput.value = resource.url;
            pillarSelect.value = resource.associatedEntityId;
        }
    }

    // Remove old listeners to prevent duplicates
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    const newCancelBtn = document.getElementById('cancel-resource-btn').cloneNode(true);
    document.getElementById('cancel-resource-btn').parentNode.replaceChild(newCancelBtn, document.getElementById('cancel-resource-btn'));

    newSaveBtn.addEventListener('click', () => saveLearningResource(mode, resourceId));
    newCancelBtn.addEventListener('click', () => hideModal('learning-resource-modal'));

    showModal('learning-resource-modal');
}

/** Saves a new or edited learning resource. */
function saveLearningResource(mode, resourceId = null) {
    const name = document.getElementById('resource-name-input').value.trim();
    const url = document.getElementById('resource-url-input').value.trim();
    const associatedEntityId = document.getElementById('resource-pillar-select').value;

    if (!name || !url || !associatedEntityId) {
        showMessage('Please fill in all fields.', false);
        return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showMessage('Please enter a valid URL (starting with http:// or https://).', false);
        return;
    }

    const newOrUpdatedResource = {
        id: resourceId || generateUUID(),
        name,
        url,
        associatedEntityId
    };

    if (mode === 'edit-resource') {
        const index = AppState.learningResources.findIndex(r => r.id === resourceId);
        if (index !== -1) {
            AppState.learningResources[index] = newOrUpdatedResource;
            showMessage('Learning resource updated!', true);
        }
    } else { // add-resource
        AppState.learningResources.push(newOrUpdatedResource);
        showMessage('Learning resource added!', true);
    }
    saveState();
    hideModal('learning-resource-modal');
    renderLearningResourcesInSettings(); // Refresh the list in settings
}

/** Shows the daily micro-challenge modal. */
function showMicroChallengeModal() {
    const todayFormatted = formatDate(new Date());
    let currentMicroChallenge = AppState.microChallenges.find(mc => mc.date === todayFormatted);

    if (!currentMicroChallenge) {
        shuffleArray(microChallengePool);
        const selectedChallenge = microChallengePool[0];
        currentMicroChallenge = {
            id: generateUUID(),
            text: selectedChallenge.text,
            date: todayFormatted,
            completed: false
        };
        AppState.microChallenges.push(currentMicroChallenge);
        AppState.lastMicroChallengeDate = todayFormatted; // Mark it as generated for today
        saveState();
    }

    const microChallengeText = document.getElementById('micro-challenge-text');
    const completeBtn = document.getElementById('complete-micro-challenge-btn');
    const skipBtn = document.getElementById('skip-micro-challenge-btn');

    microChallengeText.textContent = currentMicroChallenge.text;

    if (currentMicroChallenge.completed) {
        completeBtn.textContent = 'Challenge Completed!';
        completeBtn.disabled = true;
        skipBtn.classList.add('hidden');
    } else {
        completeBtn.textContent = `Complete Challenge (+${MICRO_CHALLENGE_TOKEN_REWARD} Tokens)`;
        completeBtn.disabled = false;
        skipBtn.classList.remove('hidden');
    }

    showModal('micro-challenge-modal');

    // Remove existing listeners before adding new ones
    const newCompleteBtn = completeBtn.cloneNode(true);
    completeBtn.parentNode.replaceChild(newCompleteBtn, completeBtn);
    const newSkipBtn = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);

    newCompleteBtn.addEventListener('click', () => {
        if (!currentMicroChallenge.completed) {
            currentMicroChallenge.completed = true;
            AppState.tokens += MICRO_CHALLENGE_TOKEN_REWARD;
            saveState();
            checkAchievements();
            showMessage(`Micro-challenge completed! You earned ${MICRO_CHALLENGE_TOKEN_REWARD} tokens!`, true);
            hideModal('micro-challenge-modal');
            renderDashboard(); // Refresh dashboard token display
        }
    });

    newSkipBtn.addEventListener('click', () => {
        hideModal('micro-challenge-modal');
        showMessage('Micro-challenge skipped for today.', false);
    });
}


// --- Achievements Logic ---
/** Checks for and unlocks achievements. */
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
    if (AppState.currentStreak >= 90 && !AppState.earnedBadges.has('consistency-streak-90')) {
        AppState.earnedBadges.add('consistency-streak-90');
        showMessage('Achievement Unlocked: 90-Day Streak! 🏆', true);
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
    if (AppState.tokens >= 50 && !AppState.earnedBadges.has('token-tycoon-50')) {
        AppState.earnedBadges.add('token-tycoon-50');
        showMessage('Achievement Unlocked: Token Tycoon (50)! 💰', true);
    }
    if (AppState.tokens >= 100 && !AppState.earnedBadges.has('token-tycoon-100')) {
        AppState.earnedBadges.add('token-tycoon-100');
        showMessage('Achievement Unlocked: Token Tycoon (100)! 💎', true);
    }

    // Skill Explorer
    const distinctSkillsCompleted = new Set(Object.keys(AppState.completedSkillTasks).filter(skillId => AppState.completedSkillTasks[skillId].length > 0));
    if (distinctSkillsCompleted.size >= 5 && !AppState.earnedBadges.has('skill-explorer-5')) {
        AppState.earnedBadges.add('skill-explorer-5');
        showMessage('Achievement Unlocked: Skill Explorer (5)! 🗺️', true);
    }
    if (distinctSkillsCompleted.size >= 10 && !AppState.earnedBadges.has('skill-explorer-10')) {
        AppState.earnedBadges.add('skill-explorer-10');
        showMessage('Achievement Unlocked: Skill Explorer (10)! 🧭', true);
    }

    // Pillar Powerhouse
    const distinctPillarsCompleted = new Set(Object.keys(AppState.completedPillarTasks).filter(pillarId => AppState.completedPillarTasks[pillarId].length > 0));
    if (distinctPillarsCompleted.size >= 5 && !AppState.earnedBadges.has('pillar-powerhouse-5')) {
        AppState.earnedBadges.add('pillar-powerhouse-5');
        showMessage('Achievement Unlocked: Pillar Powerhouse (5)! 🏛️', true);
    }
    if (distinctPillarsCompleted.size >= 10 && !AppState.earnedBadges.has('pillar-powerhouse-10')) {
        AppState.earnedBadges.add('pillar-powerhouse-10');
        showMessage('Achievement Unlocked: Pillar Powerhouse (10)! 🏰', true);
    }

    // Goal Getter
    if (AppState.globalGoals.some(g => g.completed) && !AppState.earnedBadges.has('goal-getter-first')) {
        AppState.earnedBadges.add('goal-getter-first');
        showMessage('Achievement Unlocked: First Goal Getter! 🎯', true);
    }
    const completedGlobalGoalsCount = AppState.globalGoals.filter(g => g.completed).length;
    if (completedGlobalGoalsCount >= 5 && !AppState.earnedBadges.has('goal-getter-5')) {
        AppState.earnedBadges.add('goal-getter-5');
        showMessage('Achievement Unlocked: Goal Master (5)! 🏆', true);
    }

    // Shopaholic
    if (AppState.purchasedShopItems.size >= 3 && !AppState.earnedBadges.has('shopaholic')) {
        AppState.earnedBadges.add('shopaholic');
        showMessage('Achievement Unlocked: Shopaholic! 🛍️', true);
    }

    // Quiz Master
    const perfectQuizzes = AppState.quizzes.filter(q => q.completed && q.score === q.questions.length);
    if (perfectQuizzes.length >= 3 && !AppState.earnedBadges.has('quiz-master')) {
        AppState.earnedBadges.add('quiz-master');
        showMessage('Achievement Unlocked: Quiz Master! 🧠', true);
    }

    // Journal Keeper
    if (AppState.journalEntries.length >= 10 && !AppState.earnedBadges.has('journal-keeper')) {
        AppState.earnedBadges.add('journal-keeper');
        showMessage('Achievement Unlocked: Journal Keeper! 📓', true);
    }

    // Micro-Challenge Pro
    const completedMicroChallenges = AppState.microChallenges.filter(mc => mc.completed).length;
    if (completedMicroChallenges >= 5 && !AppState.earnedBadges.has('micro-challenge-pro')) {
        AppState.earnedBadges.add('micro-challenge-pro');
        showMessage('Achievement Unlocked: Micro-Challenge Pro! ⚡', true);
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
        // Set startDate to the beginning of today in local timezone only when personalization is complete
        AppState.startDate = new Date();
        AppState.startDate.setHours(0, 0, 0, 0);
        AppState.lastVisitDate = formatDate(new Date()); // Record today as last visit
        AppState.today = 1; // Start on Day 1
        saveState();
        document.getElementById('personalization-menu').classList.add('hidden');
        document.getElementById('app-main-content').classList.remove('hidden');
        updateView('dashboard');
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
            showMessage('Affirmation added!', true);
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

        AppState.dailyActivityMap[todayFormatted] = AppState.dailyActivityMap[todayFormatted] || {};

        if (AppState.restDaysAvailable > 0) {
            AppState.restDaysAvailable--;
            AppState.completedDays.add(currentChallengeDay);
            AppState.dailyActivityMap[todayFormatted].main = true;
            AppState.dailyActivityMap[todayFormatted].skippedWithRestDay = true;
            showMessage('Rest day used! Mission marked as complete.', true);
        } else {
            AppState.completedDays.add(currentChallengeDay);
            AppState.currentStreak++;
            AppState.dailyActivityMap[todayFormatted].main = true;
            AppState.dailyActivityMap[todayFormatted].skippedWithRestDay = false;

            // Earn tokens for completing main mission
            AppState.tokens += 1;
            showMessage('Mission complete! You earned 1 Glow Token! ✨', true);
        }

        if (AppState.currentStreak > AppState.bestStreak) {
            AppState.bestStreak = AppState.currentStreak;
        }

        saveState();
        checkAchievements();
        renderDashboard();
        renderCalendar();
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
            renderDashboard();
            renderCalendar();
        } else {
            showMessage('Please enter a reason.', false);
        }
    });

    // Back buttons for detail views
    document.getElementById('back-to-pillars-btn').addEventListener('click', () => {
        document.getElementById('pillar-detail-view').classList.add('hidden');
        document.getElementById('pillars').classList.remove('hidden');
        updateView('pillars');
    });

    document.getElementById('back-to-skills-btn').addEventListener('click', () => {
        document.getElementById('skill-detail-view').classList.add('hidden');
        document.getElementById('skills').classList.remove('hidden');
        updateView('skills');
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
                AppState.nextDailyFocusBonus = 0;
                showMessage(`Bonus! You earned ${tokensEarned} Glow Tokens! ✨`, true);
            } else {
                showMessage(`You earned ${tokensEarned} Glow Tokens! ✨`, true);
            }
            AppState.tokens += tokensEarned;
            AppState.dailyFocusCompletedToday = true;
            saveState();
            checkAchievements();
            renderDailyFocus();
            renderDashboard();
        } else {
            showMessage('Please complete all daily focus tasks first!', false);
        }
    });

    // Journal Save Button
    document.getElementById('save-journal-btn').addEventListener('click', () => {
        const journalInput = document.getElementById('journal-input');
        const journalMoodSelect = document.getElementById('journal-mood-select');
        const journalTagsInput = document.getElementById('journal-tags-input');
        const todayFormatted = formatDate(new Date());

        const content = journalInput.value.trim();
        const mood = journalMoodSelect.value;
        const tags = journalTagsInput.value.split(/[, ]+/).map(tag => tag.trim()).filter(tag => tag !== ''); // Split by space or comma
        const highlight = AppState.dailyActivityMap[todayFormatted]?.highlight || '';

        if (content || mood || highlight || tags.length > 0) {
            const existingEntryIndex = AppState.journalEntries.findIndex(entry => entry.date === todayFormatted);
            if (existingEntryIndex !== -1) {
                AppState.journalEntries[existingEntryIndex].content = content;
                AppState.journalEntries[existingEntryIndex].mood = mood;
                AppState.journalEntries[existingEntryIndex].highlight = highlight;
                AppState.journalEntries[existingEntryIndex].tags = tags;
            } else {
                AppState.journalEntries.push({
                    id: generateUUID(),
                    date: todayFormatted,
                    mood: mood,
                    highlight: highlight,
                    content: content,
                    tags: tags
                });
            }
            saveState();
            checkAchievements(); // Check for journal-keeper badge
            showMessage('Journal entry saved!', true);
            renderFilteredJournalEntries();
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
        showMessage('Journal filters cleared.', true);
    });

    // Settings Tab Navigation
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active-tab'));
            e.target.classList.add('active-tab');

            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`settings-tab-${e.target.dataset.tab}`).classList.remove('hidden');

            if (e.target.dataset.tab === 'themes') {
                applyTheme(AppState.theme, false);
            }
            if (e.target.dataset.tab === 'content') {
                renderSettings(); // Re-render all content lists
            }
        });
    });

    // Settings input change listeners
    document.getElementById('settings-user-name').addEventListener('input', (e) => {
        AppState.userName = e.target.value.trim();
        saveState();
        renderDashboard();
    });

    document.getElementById('settings-difficulty-select').addEventListener('change', (e) => {
        AppState.difficulty = e.target.value;
        saveState();
        showMessage('Difficulty setting updated.', true);
    });

    document.getElementById('notification-toggle').addEventListener('change', (e) => {
        AppState.notificationsEnabled = e.target.checked;
        saveState();
        applyAccessibilitySettings(); // This will show/hide time setting
        showMessage(`Notifications ${AppState.notificationsEnabled ? 'enabled' : 'disabled'}.`, true);
    });

    document.getElementById('notification-time').addEventListener('change', (e) => {
        AppState.notificationTime = e.target.value;
        saveState();
        showMessage('Notification time saved.', true);
    });

    document.getElementById('reduce-motion-toggle').addEventListener('change', (e) => {
        AppState.reduceMotion = e.target.checked;
        saveState();
        applyAccessibilitySettings();
        showMessage(`Reduce motion ${AppState.reduceMotion ? 'enabled' : 'disabled'}.`, true);
    });

    document.getElementById('font-size-select').addEventListener('change', (e) => {
        AppState.fontSize = e.target.value;
        saveState();
        applyFontSettings();
        showMessage('Font size updated.', true);
    });

    document.getElementById('font-family-select').addEventListener('change', (e) => {
        AppState.fontFamily = e.target.value;
        saveState();
        applyFontSettings();
        showMessage('Font family updated.', true);
    });

    document.getElementById('start-onboarding-tour-btn').addEventListener('click', () => {
        showMessage('Onboarding tour would start here! (Feature coming soon)', true);
        // You could implement a series of modals or highlight elements here.
    });


    document.getElementById('settings-theme-select').addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });

    document.getElementById('save-custom-theme-btn').addEventListener('click', saveCustomTheme);

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
            showMessage('Affirmation added to your custom list!', true);
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
            pillarsData = [...defaultPillarsData, ...AppState.customPillars];
            showMessage('Custom Pillar added!', true);
        } else if (customModalMode === 'edit-pillar') {
            const index = AppState.customPillars.findIndex(p => p.id === customModalEntityId);
            if (index !== -1) AppState.customPillars[index] = newOrUpdatedEntity;
            pillarsData = [...defaultPillarsData, ...AppState.customPillars];
            showMessage('Custom Pillar updated!', true);
        } else if (customModalMode === 'add-skill') {
            AppState.customSkills.push(newOrUpdatedEntity);
            skillsData = [...defaultSkillsData, ...AppState.customSkills];
            showMessage('Custom Skill added!', true);
        } else if (customModalMode === 'edit-skill') {
            const index = AppState.customSkills.findIndex(s => s.id === customModalEntityId);
            if (index !== -1) AppState.customSkills[index] = newOrUpdatedEntity;
            skillsData = [...defaultSkillsData, ...AppState.customSkills];
            showMessage('Custom Skill updated!', true);
        }

        saveState();
        hideModal('custom-pillar-skill-modal');
        renderSettings(); // Re-render settings to show updated lists
    });

    // Learning Resources Management
    document.getElementById('add-learning-resource-btn').addEventListener('click', () => showLearningResourceModal('add-resource'));

    // Quiz Management
    document.getElementById('add-quiz-btn').addEventListener('click', () => showQuizModal('create-quiz'));

    // Daily Micro-Challenge Button
    document.getElementById('start-micro-challenge-btn').addEventListener('click', showMicroChallengeModal);


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
        showMessage('Data exported successfully!', true);
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
                        // Basic validation: check for a few key properties
                        if (importedState.isPersonalized !== undefined && importedState.userName !== undefined && importedState.completedDays !== undefined) {
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
        const confirmReset = document.createElement('div');
        confirmReset.className = 'modal-overlay';
        confirmReset.innerHTML = `
            <div class="card p-6 w-11/12 max-w-sm text-center">
                <h3 class="font-bold text-xl mb-4 text-red-600 text-primary">Reset All Progress?</h3>
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
