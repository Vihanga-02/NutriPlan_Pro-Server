import { GoogleGenerativeAI } from '@google/generative-ai';
import geminiConfig from '../config/gemini.js';

let genAI = null;
let chatModel = null;

if (geminiConfig.apiKey) {
  try {
    genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
    // Initialize with default model (will be recreated with system context per request)
    chatModel = genAI.getGenerativeModel({
      model: geminiConfig.model,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });
    console.log(`✅ Gemini AI initialized with model: ${geminiConfig.model}`);
  } catch (error) {
    console.error('❌ Failed to initialize Gemini AI:', error.message);
    chatModel = null;
  }
} else {
  console.warn('⚠️  GEMINI_API_KEY not found in environment variables. Chatbot will use fallback responses.');
}

// Function to get model instance with system instructions
const getModelInstance = (systemContext) => {
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: geminiConfig.model,
    systemInstruction: {
      parts: [{ text: systemContext }]
    },
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  });
};

const SYSTEM_CONTEXT_EN = `You are Dr. NutriBot, an AI nutrition and health advisor for NutriPlan Pro, a hybrid bakery & restaurant with precision nutrition services. You are knowledgeable, friendly, and supportive.

Your expertise includes:
- Nutritional science and dietary guidance
- BMI, BMR, TDEE calculations and interpretation
- Weight management (loss, gain, maintenance)
- Macronutrients and micronutrients
- Meal planning and portion control
- Healthy eating habits
- Food allergies and dietary restrictions
- Exercise and fitness basics
- Body composition analysis

Guidelines:
1. Provide accurate, evidence-based nutritional information
2. Be supportive and non-judgmental
3. Encourage healthy, sustainable habits
4. Recommend consulting healthcare professionals for medical concerns
5. Keep responses concise and practical (2-4 paragraphs max)
6. Use simple language accessible to everyone
7. Respond in English language ONLY
8. Relate answers to NutriPlan Pro's services when relevant

Important disclaimers:
- You are NOT a replacement for medical professionals
- Always recommend consulting doctors for health conditions
- Do not diagnose medical conditions
- Provide general wellness guidance only`;

const SYSTEM_CONTEXT_SI = `ඔබ NutriPlan Pro හි AI පෝෂණ සහ සෞඛ්‍ය උපදේශකයෙකු වන Dr. NutriBot ය. NutriPlan Pro යනු නිවැරදි පෝෂණ සේවා සහිත හයිබ්‍රිඩ් බේකරි සහ අවන්හලකි. ඔබ දැනුවත්, මිත්‍රශීලී සහ සහාය දක්වන අයෙකි.

ඔබගේ විශේෂඥ අංශ:
- පෝෂණ විද්‍යාව සහ ආහාර මාර්ගෝපදේශ
- BMI, BMR, TDEE ගණනය කිරීම් සහ අර්ථ දැක්වීම්
- බර කළමනාකරණය (අඩු කිරීම, වැඩි කිරීම, නඩත්තු කිරීම)
- මැක්‍රොපෝෂක සහ ක්ෂුද්‍ර පෝෂක
- ආහාර සැලසුම් කිරීම සහ කොටස් පාලනය
- සෞඛ්‍ය සම්පන්න ආහාර පුරුදු
- ආහාර අසාත්මිකතා සහ ආහාර සීමාවන්
- ව්‍යායාම සහ යෝග්‍යතා මූලික කරුණු
- ශරීර සංයුතිය විශ්ලේෂණය

මාර්ගෝපදේශ:
1. නිවැරදි, සාක්ෂි මත පදනම් වූ පෝෂණ තොරතුරු ලබා දෙන්න
2. සහාය දක්වන සහ විනිශ්චය නොකරන ආකාරයෙන් කටයුතු කරන්න
3. සෞඛ්‍ය සම්පන්න, තිරසාර පුරුදු දිරිමත් කරන්න
4. වෛද්‍ය ගැටළු සඳහා සෞඛ්‍ය වෘත්තිකයන් හමුවීම නිර්දේශ කරන්න
5. ප්‍රතිචාර සංක්ෂිප්ත සහ ප්‍රායෝගික තබන්න (ඡේද 2-4 උපරිමය)
6. සෑම කෙනෙකුටම ප්‍රවේශ විය හැකි සරල භාෂාව භාවිතා කරන්න
7. සිංහල භාෂාවෙන් පමණක් ප්‍රතිචාර දක්වන්න
8. පිළිතුරු NutriPlan Pro හි සේවා සමඟ සම්බන්ධ කරන්න

වැදගත් වියාචන:
- ඔබ වෛද්‍ය වෘත්තිකයන්ගේ ප්‍රතිස්ථාපනයක් නොවේ
- සෞඛ්‍ය තත්වයන් සඳහා සැමවිටම වෛද්‍යවරුන් හමුවීම නිර්දේශ කරන්න
- වෛද්‍ය තත්වයන් හඳුනා නොගන්න
- සාමාන්‍ය සුව සැලසුම් මාර්ගෝපදේශ පමණක් ලබා දෙන්න`;

export const chatWithBot = async (userMessage, conversationHistory = [], language = 'en') => {
  if (!chatModel) {
    console.warn('Gemini chatModel not initialized. Check GEMINI_API_KEY in .env file.');
    return getFallbackResponse(userMessage, language);
  }

  try {
    const SYSTEM_CONTEXT = language === 'si' ? SYSTEM_CONTEXT_SI : SYSTEM_CONTEXT_EN;

    // Build conversation history for Gemini
    // Filter and map history, ensuring it starts with 'user' role and alternates properly
    let history = conversationHistory
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
      .filter((msg, index) => {
        // Remove any leading 'model' messages - history must start with 'user'
        if (index === 0 && msg.role === 'model') {
          return false;
        }
        return true;
      });

    // Ensure history alternates properly (user -> model -> user -> model...)
    const cleanedHistory = [];
    for (let i = 0; i < history.length; i++) {
      const current = history[i];
      const previous = cleanedHistory[cleanedHistory.length - 1];
      
      // Skip if same role as previous (except for first message which must be user)
      if (previous && previous.role === current.role) {
        continue;
      }
      
      // First message must be 'user'
      if (cleanedHistory.length === 0 && current.role !== 'user') {
        continue;
      }
      
      cleanedHistory.push(current);
    }

    // Create model instance with system instructions
    const modelWithContext = getModelInstance(SYSTEM_CONTEXT);
    
    const chat = modelWithContext.startChat({
      history: cleanedHistory,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    // Send just the user message (system context is in system instructions)
    const prompt = userMessage;

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const botReply = response.text();

    if (!botReply || botReply.trim().length === 0) {
      throw new Error('Empty response from Gemini API');
    }

    return {
      success: true,
      message: botReply,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('AI Chatbot error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userMessage: userMessage.substring(0, 50)
    });
    // Return fallback but log the error for debugging
    const fallback = getFallbackResponse(userMessage, language);
    return {
      ...fallback,
      success: true, // Still return success so client can display it
      warning: 'Using fallback response due to API error'
    };
  }
};

export const getQuickAnswer = async (question, language = 'en') => {
  if (!chatModel) {
    return getFallbackResponse(question, language);
  }

  try {
    const SYSTEM_CONTEXT = language === 'si' ? SYSTEM_CONTEXT_SI : SYSTEM_CONTEXT_EN;
    const promptText = language === 'si'
      ? 'මෙම ප්‍රශ්නයට වාක්‍ය 2-3 කින් කෙටි, උපකාරී පිළිතුරක් ලබා දෙන්න:'
      : 'Provide a brief, helpful answer to this question in 2-3 sentences:';

    const prompt = `${SYSTEM_CONTEXT}\n\n${promptText}\n\n${language === 'si' ? 'ප්‍රශ්නය' : 'Question'}: ${question}`;

    const result = await chatModel.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();

    return {
      success: true,
      message: answer,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Quick answer error:', error);
    return getFallbackResponse(question, language);
  }
};

export const analyzeHealthMetrics = async (metrics, language = 'en') => {
  const { bmi, bmr, tdee, bodyFat, age, gender, goal } = metrics;

  if (!chatModel) {
    return getFallbackHealthAnalysis(metrics, language);
  }

  try {
    const SYSTEM_CONTEXT = language === 'si' ? SYSTEM_CONTEXT_SI : SYSTEM_CONTEXT_EN;

    const prompt = language === 'si'
      ? `${SYSTEM_CONTEXT}\n\nමෙම සෞඛ්‍ය මිනුම් විශ්ලේෂණය කර පුද්ගලාරෝපිත උපදෙස් ලබා දෙන්න:

මිනුම්:
- BMI: ${bmi}
- BMR: ${bmr} කැලරි/දිනය
- TDEE: ${tdee} කැලරි/දිනය
- ශරීර මේද: ${bodyFat}%
- වයස: ${age}
- ස්ත්‍රී/පුරුෂ භාවය: ${gender}
- ඉලක්කය: ${goal}

ලබා දෙන්න:
1. මිනුම් හි කෙටි අර්ථ නිරූපණය (වාක්‍ය 1-2)
2. දෛනික කැලරි නිර්දේශය
3. මැක්‍රොපෝෂක ඉලක්ක (ප්‍රෝටීන්, කාබෝහයිඩ්‍රේට්, මේද ග්‍රෑම්වලින්)
4. ක්‍රියාත්මක කළ හැකි නිශ්චිත උපදෙස් 3ක්

ප්‍රතිචාරය වචන 200 ට අඩු තබන්න.`
      : `${SYSTEM_CONTEXT}\n\nAnalyze these health metrics and provide personalized advice:

Metrics:
- BMI: ${bmi}
- BMR: ${bmr} calories/day
- TDEE: ${tdee} calories/day
- Body Fat: ${bodyFat}%
- Age: ${age}
- Gender: ${gender}
- Goal: ${goal}

Provide:
1. Brief interpretation of metrics (1-2 sentences)
2. Daily calorie recommendation
3. Macronutrient targets (protein, carbs, fat in grams)
4. 3 specific actionable tips

Keep response under 200 words.`;

    const result = await chatModel.generateContent(prompt);
    const response = await result.response;
    const analysis = response.text();

    return {
      success: true,
      message: analysis,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Health metrics analysis error:', error);
    return getFallbackHealthAnalysis(metrics, language);
  }
};

export const suggestMealsByGoal = async (goal, dietaryRestrictions = [], preferredCuisine = 'any', language = 'en') => {
  if (!chatModel) {
    return getFallbackMealSuggestions(goal, language);
  }

  try {
    const SYSTEM_CONTEXT = language === 'si' ? SYSTEM_CONTEXT_SI : SYSTEM_CONTEXT_EN;

    const restrictionsText = dietaryRestrictions.length > 0
      ? (language === 'si' ? `ආහාර සීමාවන්: ${dietaryRestrictions.join(', ')}` : `Dietary restrictions: ${dietaryRestrictions.join(', ')}`)
      : (language === 'si' ? 'ආහාර සීමාවන් නැත' : 'No dietary restrictions');

    const prompt = language === 'si'
      ? `${SYSTEM_CONTEXT}\n\nමෙම ඉලක්කය ඇති කෙනෙකු සඳහා ආහාර අදහස් 5ක් යෝජනා කරන්න: ${goal}

${restrictionsText}
කැමති ආහාර වර්ගය: ${preferredCuisine}

එක් එක් ආහාරය සඳහා, ලබා දෙන්න:
- ආහාර නම
- කෙටි විස්තරය (වාක්‍ය 1)
- ඇස්තමේන්තුගත කැලරි
- මෙය මෙම ඉලක්කය සඳහා හොඳ වන්නේ මන්ද

සරල ලැයිස්තුවක් ලෙස ආකෘතිගත කරන්න.`
      : `${SYSTEM_CONTEXT}\n\nSuggest 5 meal ideas for someone with this goal: ${goal}

${restrictionsText}
Preferred cuisine: ${preferredCuisine}

For each meal, provide:
- Meal name
- Brief description (1 sentence)
- Estimated calories
- Why it's good for this goal

Format as a simple list.`;

    const result = await chatModel.generateContent(prompt);
    const response = await result.response;
    const suggestions = response.text();

    return {
      success: true,
      message: suggestions,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Meal suggestions error:', error);
    return getFallbackMealSuggestions(goal, language);
  }
};

const getFallbackResponse = (userMessage, language = 'en') => {
  const message = userMessage.toLowerCase();

  const responses = language === 'si' ? {
    bmi: "BMI (Body Mass Index) ගණනය කරන්නේ බර(kg) / උස(m)² ලෙසයි. සෞඛ්‍ය සම්පන්න BMI සාමාන්‍යයෙන් 18.5-24.9 වේ. ඔබේ මිනුම් විස්තරාත්මක විශ්ලේෂණයක් සඳහා අපගේ සෞඛ්‍ය පරීක්ෂණ මෙවලම භාවිතා කරන්න!",

    weight_loss: "සෞඛ්‍ය සම්පන්න බර අඩු කිරීම සඳහා: 1) කැලරි හිඟයක් නිර්මාණය කරන්න (ඔබේ TDEE ට වඩා කැලරි 300-500 අඩුවෙන් අනුභව කරන්න), 2) ප්‍රෝටීන් සහ එළවළු වලට අවධානය යොමු කරන්න, 3) නිතිපතා ව්‍යායාම කරන්න, 4) ජලය පානය කරන්න, 5) පැය 7-8 නින්ද ගන්න. පුද්ගලාරෝපිත සැලසුම් සඳහා අපගේ ආහාර සැලසුම් විශේෂාංගය උත්සාහ කරන්න!",

    protein: "හොඳ ප්‍රෝටීන් ප්‍රභවයන්ට: කුකුළු මස්, මාළු, බිත්තර, ග්‍රීක් යෝගට්, පරිප්පු, බෝංචි, ටෝෆු සහ ගෙඩි ඇතුළත් වේ. ඔබ ක්‍රියාශීලී නම් ශරීර බර කි.ග්‍රෑ.යකට 1.6-2.2g ඉලක්ක කරන්න. ඉහළ ප්‍රෝටීන් විකල්ප සඳහා අපගේ මෙනුව පරීක්ෂා කරන්න!",

    calories: "ඔබේ දෛනික කැලරි අවශ්‍යතා ඔබේ BMR සහ ක්‍රියාකාරකම් මට්ටම (TDEE) මත රඳා පවතී. ඔබේ පුද්ගලාරෝපිත අවශ්‍යතා ගණනය කිරීමට අපගේ සෞඛ්‍ය පරීක්ෂණ මෙවලම භාවිතා කරන්න!",

    meal_plan: "අපි ඔබේ ඉලක්කවලට අනුකූල වන AI-ජනිත දින 14ක ආහාර සැලසුම් ලබා දෙමු! පුද්ගලාරෝපිත පෝෂණ සැලසුම් කිරීම ආරම්භ කිරීමට ලියාපදිංචි වී ඔබේ සෞඛ්‍ය පැතිකඩ සම්පූර්ණ කරන්න.",

    exercise: "හොඳම ප්‍රතිඵල සඳහා cardio (සතියකට මිනිත්තු 150) ශක්ති පුහුණුව (සතියකට 2-3x) සමඟ ඒකාබද්ධ කරන්න. හෙමින් ආරම්භ කර ක්‍රමයෙන් තීව්‍රතාවය වැඩි කරන්න. අපගේ ආහාර සැලසුම්වලින් නිසි පෝෂණය ඔබේ ව්‍යායාම සඳහා ඉන්ධන සපයයි!",

    default: "මම Dr. NutriBot, ඔබේ පෝෂණ උපදේශකයා! මට BMI ගණනය කිරීම්, බර කළමනාකරණය, ආහාර සැලසුම් කිරීම, පෝෂණ කරුණු සහ සෞඛ්‍ය සම්පන්න ආහාර ගැනීමේ ඉඟි සමඟ උදව් කළ හැක. ඔබ දැන ගැනීමට කැමති කුමක්ද?"
  } : {
    bmi: "BMI (Body Mass Index) is calculated as weight(kg) / height(m)². A healthy BMI is typically 18.5-24.9. Use our Health Screening tool for a detailed analysis of your metrics!",

    weight_loss: "For healthy weight loss: 1) Create a calorie deficit (eat 300-500 calories less than your TDEE), 2) Focus on protein and vegetables, 3) Exercise regularly, 4) Stay hydrated, 5) Get 7-8 hours of sleep. Try our meal planning feature for personalized plans!",

    protein: "Good protein sources include: lean chicken, fish, eggs, Greek yogurt, lentils, beans, tofu, and nuts. Aim for 1.6-2.2g per kg of body weight if you're active. Check our menu for high-protein options!",

    calories: "Your daily calorie needs depend on your BMR and activity level (TDEE). Use our Health Screening tool to calculate your personalized requirements!",

    meal_plan: "We offer AI-generated 14-day meal plans tailored to your goals! Sign up and complete your health profile to get started with personalized nutrition planning.",

    exercise: "Combine cardio (150 min/week) with strength training (2-3x/week) for best results. Start slowly and gradually increase intensity. Proper nutrition from our meal plans will fuel your workouts!",

    default: "I'm Dr. NutriBot, your nutrition advisor! I can help with BMI calculations, weight management, meal planning, nutrition facts, and healthy eating tips. What would you like to know?"
  };

  if (message.includes('bmi')) return { success: true, message: responses.bmi };
  if (message.includes('lose weight') || message.includes('weight loss') || message.includes('බර අඩු')) return { success: true, message: responses.weight_loss };
  if (message.includes('protein') || message.includes('ප්‍රෝටීන්')) return { success: true, message: responses.protein };
  if (message.includes('calorie') || message.includes('කැලරි')) return { success: true, message: responses.calories };
  if (message.includes('meal plan') || message.includes('ආහාර සැලසුම')) return { success: true, message: responses.meal_plan };
  if (message.includes('exercise') || message.includes('workout') || message.includes('ව්‍යායාම')) return { success: true, message: responses.exercise };

  return { success: true, message: responses.default };
};

const getFallbackHealthAnalysis = (metrics, language = 'en') => {
  const { bmi, tdee, goal } = metrics;

  let bmiCategory = language === 'si' ? 'සාමාන්‍ය' : 'normal';
  if (bmi < 18.5) bmiCategory = language === 'si' ? 'අඩු බර' : 'underweight';
  else if (bmi >= 25 && bmi < 30) bmiCategory = language === 'si' ? 'අධික බර' : 'overweight';
  else if (bmi >= 30) bmiCategory = language === 'si' ? 'තරබාරුකම' : 'obese';

  let calorieAdjustment = 0;
  if (goal === 'lose_weight') calorieAdjustment = -500;
  else if (goal === 'gain_weight') calorieAdjustment = 500;

  const targetCalories = tdee + calorieAdjustment;

  const analysis = language === 'si'
    ? `ඔබේ BMI ${bmi.toFixed(1)} පෙන්නුම් කරන්නේ ඔබ ${bmiCategory} බවයි. ඔබේ TDEE ${tdee} කැලරි/දිනය සහ ${goal.replace('_', ' ')} ඉලක්කය මත පදනම්ව, මම දිනකට ආසන්න වශයෙන් ${targetCalories} කැලරි පරිභෝජනය කිරීමට නිර්දේශ කරමි.

මැක්‍රොපෝෂක ඉලක්ක:
- ප්‍රෝටීන්: ${Math.round(targetCalories * 0.30 / 4)}g (කැලරි වලින් 30%)
- කාබෝහයිඩ්‍රේට්: ${Math.round(targetCalories * 0.40 / 4)}g (කැලරි වලින් 40%)
- මේද: ${Math.round(targetCalories * 0.30 / 9)}g (කැලරි වලින් 30%)

ඉඟි:
1. ඔබේ ආහාර නිරීක්ෂණය කර ස්ථාවරව සිටින්න
2. සෑම ආහාර වේලකදීම ප්‍රෝටීන් සහිත ආහාර අනුභව කරන්න
3. ජලය පානය කරන්න (දිනකට වතුර වීදුරු 8-10)

පුද්ගලාරෝපිත පෝෂණ සැලසුම් සඳහා අපගේ ආහාර සැලසුම් විශේෂාංගය භාවිතා කරන්න!`
    : `Your BMI of ${bmi.toFixed(1)} indicates you are ${bmiCategory}. Based on your TDEE of ${tdee} calories/day and your goal to ${goal.replace('_', ' ')}, I recommend consuming approximately ${targetCalories} calories daily.

Macronutrient targets:
- Protein: ${Math.round(targetCalories * 0.30 / 4)}g (30% of calories)
- Carbs: ${Math.round(targetCalories * 0.40 / 4)}g (40% of calories)
- Fat: ${Math.round(targetCalories * 0.30 / 9)}g (30% of calories)

Tips:
1. Track your meals and stay consistent
2. Eat protein-rich foods at every meal
3. Stay hydrated (8-10 glasses of water daily)

Use our meal planning feature for personalized nutrition plans!`;

  return {
    success: true,
    message: analysis,
    timestamp: new Date().toISOString()
  };
};

const getFallbackMealSuggestions = (goal, language = 'en') => {
  const suggestions = language === 'si' ? {
    lose_weight: `බර අඩු කිරීම සඳහා ආහාර යෝජනා:

1. ග්‍රිල් කළ චිකන් සලාද (~350 cal) - ඉහළ ප්‍රෝටීන්, අඩු carb, පිරවීම
2. Quinoa Buddha Bowl (~400 cal) - තන්තු බහුල, පෝෂක ඝන
3. එළවළු සමඟ බේක් කළ සැල්මන් (~380 cal) - Omega-3s, අඩු කැලරි
4. පොල්කිරි සමඟ බිත්තර සුදු Omelet (~200 cal) - ඉහළ ප්‍රෝටීන් උදෑසන ආහාරය
5. සම්පූර්ණ ධාන්‍ය පාන් සමඟ පරිප්පු සුප් (~320 cal) - පිරවීම, ශාක පදනම් වූ

සියලුම ආහාර කොටස් පාලිත වන අතර කැලරි හිඟයක් පවත්වා ගනිමින් ඔබව සෑහීමකට පත් කිරීමට නිර්මාණය කර ඇත.`,

    gain_weight: `සෞඛ්‍ය සම්පන්න බර වැඩි කිරීම සඳහා ආහාර යෝජනා:

1. චිකන් සහ බත් බඳුන (~650 cal) - ඉහළ ප්‍රෝටීන්, සංකීර්ණ carbs
2. රටකජු බටර් කෙසෙල් ස්මූති (~500 cal) - කැලරි ඝන, පෝෂ්‍යදායී
3. මස් සෝස් සමඟ පාස්තා (~700 cal) - මාංශ පේශි සඳහා ප්‍රෝටීන් සහ carbs
4. උදෑසන Burrito (~550 cal) - බිත්තර, චීස්, අලිගැට පේර
5. Trail Mix සහ ග්‍රීක් යෝගට් (~450 cal) - සෞඛ්‍ය සම්පන්න මේද, ප්‍රෝටීන්

සෞඛ්‍ය සම්පන්න බර වැඩි කිරීමට සහාය වීමට පෝෂක ඝන, කැලරි බහුල ආහාර වලට අවධානය යොමු කරන්න.`,

    default: `සමබර ආහාර යෝජනා:

1. මධ්‍යධරණී බඳුන (~450 cal) - සමබර මැක්‍රොපෝෂක
2. ග්‍රිල් කළ මාළු Tacos (~400 cal) - කෙට්ටු ප්‍රෝටීන්, සෞඛ්‍ය සම්පන්න මේද
3. දුඹුරු බත් සමඟ Stir-Fry (~500 cal) - එළවළු, ප්‍රෝටීන්, සම්පූර්ණ ධාන්‍ය
4. ග්‍රීක් යෝගට් Parfait (~300 cal) - ප්‍රෝටීන්, ප්‍රෝබයොටික්
5. සම්පූර්ණ තිරිඟු සැන්ඩ්විච් (~380 cal) - සමබර, පහසු

මෙම ආහාර ඔබේ වර්තමාන බර පවත්වා ගැනීම සඳහා සමබර පෝෂණය සපයයි.`
  } : {
    lose_weight: `Meal suggestions for weight loss:

1. Grilled Chicken Salad (~350 cal) - High protein, low carb, filling
2. Quinoa Buddha Bowl (~400 cal) - Fiber-rich, nutrient-dense
3. Baked Salmon with Vegetables (~380 cal) - Omega-3s, low calorie
4. Egg White Omelet with Spinach (~200 cal) - High protein breakfast
5. Lentil Soup with Whole Grain Bread (~320 cal) - Filling, plant-based

All meals are portion-controlled and designed to keep you satisfied while maintaining a calorie deficit.`,

    gain_weight: `Meal suggestions for healthy weight gain:

1. Chicken & Rice Bowl (~650 cal) - High protein, complex carbs
2. Peanut Butter Banana Smoothie (~500 cal) - Calorie-dense, nutritious
3. Pasta with Meat Sauce (~700 cal) - Protein and carbs for muscle
4. Breakfast Burrito (~550 cal) - Eggs, cheese, avocado
5. Trail Mix & Greek Yogurt (~450 cal) - Healthy fats, protein

Focus on nutrient-dense, calorie-rich foods to support healthy weight gain.`,

    default: `Balanced meal suggestions:

1. Mediterranean Bowl (~450 cal) - Balanced macros
2. Grilled Fish Tacos (~400 cal) - Lean protein, healthy fats
3. Stir-Fry with Brown Rice (~500 cal) - Veggies, protein, whole grains
4. Greek Yogurt Parfait (~300 cal) - Protein, probiotics
5. Whole Wheat Sandwich (~380 cal) - Balanced, convenient

These meals provide balanced nutrition for maintaining your current weight.`
  };

  return {
    success: true,
    message: suggestions[goal] || suggestions.default,
    timestamp: new Date().toISOString()
  };
};

export default {
  chatWithBot,
  getQuickAnswer,
  analyzeHealthMetrics,
  suggestMealsByGoal
};
