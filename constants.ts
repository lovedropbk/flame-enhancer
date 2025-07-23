

import { Question } from './types';

export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash'; // Updated to valid model
export const GEMINI_IMAGE_MODEL = 'imagen-3.0-generate-002'; // Corrected model name

export const MAX_BIO_LENGTH = 600; // Tinder's bio limit
export const RECOMMENDED_BIO_LENGTH = 400; // For bio generation, increased slightly

export const MAX_UPLOAD_PHOTOS = 30;
export const NUM_PHOTOS_TO_SELECT = 5; // Will select top 5 photos

export const ESSENTIAL_QUESTIONS: Question[] = [
  {
    id: 'q0_name',
    text: 'What\'s your first name?',
    type: 'text',
    placeholder: 'e.g., Alex',
  },
  {
    id: 'q0_age',
    text: 'How old are you?',
    type: 'text', // Using text for simplicity, can add number validation
    placeholder: 'e.g., 28',
  },
  {
    id: 'q0_gender',
    text: 'What is your gender?',
    type: 'single-choice',
    options: ['Male', 'Female', 'Transgender'],
  },
  {
    id: 'q0_target_gender',
    text: 'Who are you interested in meeting?',
    type: 'single-choice',
    options: ['Men', 'Women', 'Everyone'],
  },
  {
    id: 'q1_describe_words',
    text: 'What are three words your friends would use to describe you?',
    type: 'text',
    placeholder: 'e.g., Adventurous, witty, kind',
  },
  {
    id: 'q2_friday_night',
    text: 'Your ideal Friday night is...',
    type: 'single-choice',
    options: ['A cozy night in (movies, books)', 'Dinner and drinks with friends', 'Exploring a new spot in the city', 'A spontaneous adventure!', 'Attending a live event (concert, game)'],
  },
  {
    id: 'q3_passion_hobby',
    text: 'What\'s a passion or hobby you could talk about for hours?',
    type: 'text',
    placeholder: 'e.g., Learning new languages, competitive salsa dancing',
  },
  {
    id: 'q4_looking_for',
    text: 'What are you primarily looking for on a dating app right now?',
    type: 'multiple-choice',
    options: ['Something casual and fun', 'A serious, long-term relationship', 'Making new friends and connections', 'Figuring it out as I go', 'Someone to share specific hobbies with'],
  },
  {
    id: 'q5_fun_fact',
    text: 'Share a quick, fun fact about yourself or a recent small adventure.',
    type: 'longtext',
    placeholder: 'e.g., I once won a hot-dog eating contest!',
  },
];

// Refinement questions are removed, as this flow is replaced by the refinement modal.
export const ALL_QUESTIONS = [...ESSENTIAL_QUESTIONS];


// Old PHOTO_TYPES - might be useful to categorize selected photos later or for checklist.
export const PHOTO_TYPES: string[] = [
  "Clear Solo Headshot (face clearly visible, smiling)",
  "Full Body Shot (showcasing style or in an interesting setting)",
  "Activity/Hobby Photo (doing something you love)",
  "Travel Photo (in a unique or scenic location)",
  "Photo with a Pet (if applicable, shows personality)",
  "Social Photo (with friends, you are clearly the focus)",
  "Formal/Professional Photo (if relevant to your desired image)",
  "Candid Laughter Photo (shows genuine emotion)",
];


// List of cities for autocomplete feature
export const MAJOR_CITIES: string[] = [
  "Tokyo, Japan", "Delhi, India", "Shanghai, China", "São Paulo, Brazil", "Mumbai, India", "Mexico City, Mexico",
  "Beijing, China", "Osaka, Japan", "Cairo, Egypt", "New York, USA", "Dhaka, Bangladesh", "Karachi, Pakistan",
  "Buenos Aires, Argentina", "Kolkata, India", "Istanbul, Turkey", "Chongqing, China", "Lagos, Nigeria",
  "Manila, Philippines", "Rio de Janeiro, Brazil", "Tianjin, China", "Kinshasa, DR Congo", "Guangzhou, China",
  "Los Angeles, USA", "Moscow, Russia", "Shenzhen, China", "Lahore, Pakistan", "Bangalore, India", "Paris, France",
  "Bogotá, Colombia", "Jakarta, Indonesia", "Chennai, India", "Lima, Peru", "Bangkok, Thailand", "Seoul, South Korea",
  "Nagoya, Japan", "Hyderabad, India", "London, UK", "Tehran, Iran", "Chicago, USA", "Chengdu, China", "Nanjing, China",
  "Wuhan, China", "Ho Chi Minh City, Vietnam", "Luanda, Angola", "Ahmedabad, India", "Kuala Lumpur, Malaysia",
  "Xi'an, China", "Hong Kong, Hong Kong", "Dongguan, China", "Hangzhou, China", "Foshan, China", "Shenyang, China",
  "Riyadh, Saudi Arabia", "Baghdad, Iraq", "Santiago, Chile", "Surat, India", "Madrid, Spain", "Suzhou, China",
  "Pune, India", "Harbin, China", "Houston, USA", "Dallas, USA", "Toronto, Canada", "Dar es Salaam, Tanzania",
  "Miami, USA", "Belo Horizonte, Brazil", "Singapore, Singapore", "Philadelphia, USA", "Atlanta, USA",
  "Fukuoka, Japan", "Khartoum, Sudan", "Barcelona, Spain", "Johannesburg, South Africa", "Saint Petersburg, Russia",
  "Qingdao, China", "Dalian, China", "Washington, D.C., USA", "Yangon, Myanmar", "Alexandria, Egypt", "Jinan, China",
  "Guadalajara, Mexico", "Ankara, Turkey", "Melbourne, Australia", "Abidjan, Ivory Coast", "Phoenix, USA",
  "Recife, Brazil", "Hanoi, Vietnam", "Montreal, Canada", "Montréal, Canada", "Sydney, Australia", "Monterrey, Mexico",
  "Changsha, China", "Brasília, Brazil", "Medellín, Colombia", "Nairobi, Kenya", "Zhengzhou, China", "Berlin, Germany",
  "Cape Town, South Africa", "Rome, Italy", "Kunming, China", "Casablanca, Morocco", "Hangzhou, China",
  "San Francisco, USA", "Detroit, USA", "Seattle, USA", "Boston, USA", "San Diego, USA", "Minneapolis, USA",
  "Tampa, USA", "Denver, USA", "Vancouver, Canada", "Dubai, UAE", "Stockholm, Sweden", "Amsterdam, Netherlands",
  "Vienna, Austria", "Zurich, Switzerland", "Copenhagen, Denmark", "Helsinki, Finland", "Oslo, Norway",
  "Dublin, Ireland", "Brussels, Belgium", "Prague, Czech Republic", "Warsaw, Poland", "Budapest, Hungary",
  "Lisbon, Portugal", "Athens, Greece", "Auckland, New Zealand", "Calgary, Canada", "Edmonton, Canada",
  "Ottawa, Canada", "Quebec City, Canada", "Winnipeg, Canada", "Honolulu, USA", "Anchorage, USA",
  "Taipei, Taiwan", "Munich, Germany", "Hamburg, Germany", "Frankfurt, Germany", "Cologne, Germany",
  "Milan, Italy", "Naples, Italy", "Turin, Italy", "Marseille, France", "Lyon, France", "Toulouse, France",
  "Nice, France", "Manchester, UK", "Birmingham, UK", "Liverpool, UK", "Glasgow, UK", "Edinburgh, UK",
  "Austin, USA", "Las Vegas, USA", "Portland, USA", "Orlando, USA", "St. Louis, USA", "Pittsburgh, USA",
  "Sacramento, USA", "San Antonio, USA", "San Jose, USA", "Kansas City, USA", "Indianapolis, USA",
  "Columbus, USA", "Charlotte, USA", "Nashville, USA", "New Orleans, USA", "Tel Aviv, Israel",
  "Jerusalem, Israel", "Mecca, Saudi Arabia", "Medina, Saudi Arabia", "Doha, Qatar", "Kuwait City, Kuwait",

  "Abu Dhabi, UAE", "Muscat, Oman", "Manama, Bahrain", "Beirut, Lebanon", "Amman, Jordan", "Havana, Cuba",
  "Kingston, Jamaica", "San Juan, Puerto Rico", "Panama City, Panama", "Caracas, Venezuela", "Montevideo, Uruguay",
  "Asunción, Paraguay", "La Paz, Bolivia", "Quito, Ecuador", "Georgetown, Guyana", "Paramaribo, Suriname",
  "Cayenne, French Guiana", "Phnom Penh, Cambodia", "Vientiane, Laos", "Kathmandu, Nepal", "Colombo, Sri Lanka",
  "Malé, Maldives", "Thimphu, Bhutan", "Ulaanbaatar, Mongolia", "Pyongyang, North Korea"
];