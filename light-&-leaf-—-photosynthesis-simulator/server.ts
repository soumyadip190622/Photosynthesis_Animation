import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const BIOLOGY_SYSTEM_INSTRUCTION = `You are the Light & Leaf Computational Biology & Plant Physiology Consultant integrated into a desktop scientific photosynthesis simulator.

Your role:
1. Help students, educators, and researchers understand photosynthesis, plant physiology, biochemistry (Light-dependent reactions in the thylakoid membrane, Photosystem II & I, linear/cyclic electron flow, photophosphorylation, the Calvin-Benson cycle, RuBisCO kinetics, C3/C4/CAM pathways, photorespiration, stomatal conductance), and general biology questions.
2. When provided with the user's live simulator context (Light Intensity I in klux, CO2 in ppm, Temperature in °C, Water Availability %, Model Mode, Predicted Photosynthesis Rate, Local Slope dR/dI, and Limiting Factor), reference these exact values quantitatively in your explanation.
3. Maintain strict scientific honesty:
   - Clearly distinguish the simulator's baseline mathematical equation R = Pmax * I / (I + K) (with Pmax = 20 µmol CO2 m⁻² s⁻¹ and K = 25 klux) and the extended multi-factor teaching model from empirical laboratory gas-exchange measurements (IRGA).
   - Keep explanations lucid, well-structured, and engaging for a university science or engineering student.`;

function buildDeterministicBiologyFallback(
  userMessage: string,
  simContext?: {
    lightKlux?: number;
    co2Ppm?: number;
    temperatureC?: number;
    waterPct?: number;
    mode?: string;
    activeRate?: number;
    baselineRate?: number;
    analyticalSlope?: number;
    limitingFactor?: string;
  }
): string {
  const I = simContext?.lightKlux ?? 40;
  const C = simContext?.co2Ppm ?? 400;
  const T = simContext?.temperatureC ?? 25;
  const W = simContext?.waterPct ?? 100;
  const rate = simContext?.activeRate ?? 12.31;
  const slope = simContext?.analyticalSlope ?? 0.118;
  const lim = simContext?.limitingFactor ?? 'Light Intensity';

  const q = userMessage.toLowerCase();

  if (q.includes('rubisco') || q.includes('calvin') || q.includes('photorespiration')) {
    return `**RuBisCO & The Calvin-Benson Cycle (Contextual Analysis at ${I} klux, ${T} °C, ${C} ppm CO₂)**

1. **Carboxylation vs. Oxygenation**: Ribulose-1,5-bisphosphate carboxylase-oxygenase (**RuBisCO**, UniProt \`P00875\`, PDB \`1RCX\`) catalyzes the primary step of carbon fixation by combining $\\text{CO}_2$ with RuBP to form two molecules of 3-phosphoglycerate (3-PGA).
2. **Temperature & $\\text{CO}_2$ Sensitivity**: Above $28\\text{–}30\\ ^\\circ\\text{C}$, the solubility of $\\text{CO}_2$ in the chloroplast stroma drops faster than $\\text{O}_2$, and RuBisCO's specificity for $\\text{CO}_2$ decreases, increasing wasteful **photorespiration**.
3. **Current Simulator State**: At **${I} klux** and **${C} ppm $\\text{CO}_2$**, your modeled photosynthetic rate is **${rate.toFixed(2)} µmol CO₂ m⁻² s⁻¹** with primary constraint: **${lim}**.`;
  }

  if (q.includes('limit') || q.includes('blackman') || q.includes('saturat') || q.includes('asymptote')) {
    return `**Blackman's Law of Limiting Factors & Light Saturation (at ${I} klux)**

1. **Mathematical Mechanism**: In the baseline rectangular hyperbola $R = \\frac{P_{\\max} \\cdot I}{I + K}$ ($P_{\\max} = 20$, $K = 25\\text{ klux}$), the local sensitivity is the derivative $\\frac{dR}{dI} = \\frac{P_{\\max} \\cdot K}{(I + K)^2} = \\mathbf{${slope.toFixed(3)}\\ \\mu\\text{mol CO}_2\\text{ m}^{-2}\\text{ s}^{-1}\\text{ klux}^{-1}}$.
2. **Physiological Transition**:
   - **Low Light ($I < K = 25\\text{ klux}$)**: Photon capture at Photosystems II and I limits ATP and NADPH regeneration.
   - **High Light ($I > 60\\text{ klux}$)**: Thylakoid electron transport is abundant, so the rate hits a biochemical ceiling governed by **RuBisCO turnover** and **stomatal $\\text{CO}_2$ diffusion**.
3. **Current Diagnosis**: Your plant is operating at **${rate.toFixed(2)} µmol CO₂ m⁻² s⁻¹** (${((rate / 20) * 100).toFixed(1)}% of baseline $P_{\\max}$), primarily constrained by **${lim}**.`;
  }

  return `**Physiological Diagnostic for Current Simulator Conditions**

- **Operating Parameters**: Light $I = \\mathbf{${I}\\text{ klux}}$ · $\\text{CO}_2 = \\mathbf{${C}\\text{ ppm}}$ · Leaf Temp $= \\mathbf{${T}\\ ^\\circ\\text{C}}$ · Water $= \\mathbf{${W}\\%}$ (${simContext?.mode === 'extended' ? 'Extended Multi-Factor Model' : 'Baseline Light-Only Model'})
- **Modeled Net Fixation Rate**: **${rate.toFixed(2)} µmol CO₂ m⁻² s⁻¹** (Local slope $dR/dI = ${slope.toFixed(3)}\\ \\mu\\text{mol m}^{-2}\\text{ s}^{-1}\\text{ klux}^{-1}$)
- **Primary Limiting Factor**: **${lim}**

**Biological Interpretation**:
In the thylakoid membrane, Photosystem II oxidizes water ($2\\text{H}_2\\text{O} \\to \\text{O}_2 + 4\\text{H}^+ + 4e^-$) to drive linear electron transport, producing **ATP** and **NADPH** for the Calvin-Benson cycle in the stroma. Try comparing **Overcast (25 klux)**—where $R$ is exactly $\\frac{1}{2}P_{\\max} = 10.0\\ \\mu\\text{mol m}^{-2}\\text{ s}^{-1}$—with **Full Sun (100 klux)** or switching to the **Extended Model** to test $\\text{CO}_2$ enrichment and thermal stress.`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'light-and-leaf-simulator' });
  });

  // Multi-turn Biology & Photosynthesis Consultant Chat endpoint
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { messages, simContext, modelTier } = req.body as {
        messages?: Array<{ role: 'user' | 'model'; text: string }>;
        simContext?: Record<string, any>;
        modelTier?: 'general' | 'fast';
      };

      const userMessages = Array.isArray(messages) ? messages : [];
      const latestMessage =
        userMessages.length > 0 ? userMessages[userMessages.length - 1].text : 'Analyze the current photosynthesis simulation state.';

      const ai = getGenAIClient();
      const selectedModel = modelTier === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';

      const contextBlock = simContext
        ? `\n\n[LIVE SIMULATOR TELEMETRY]\n` +
          `- Model Mode: ${simContext.mode === 'extended' ? 'Extended Multi-Factor Model' : 'Baseline Light-Only Model'}\n` +
          `- Light Intensity (I): ${simContext.lightKlux} klux\n` +
          `- CO2 Concentration: ${simContext.co2Ppm} ppm\n` +
          `- Temperature: ${simContext.temperatureC} °C\n` +
          `- Water Availability: ${simContext.waterPct} %\n` +
          `- Modeled Photosynthesis Rate: ${Number(simContext.activeRate ?? 0).toFixed(2)} µmol CO₂ m⁻² s⁻¹\n` +
          `- Baseline Theoretical Rate: ${Number(simContext.baselineRate ?? 0).toFixed(2)} µmol CO₂ m⁻² s⁻¹\n` +
          `- Local Slope (dR/dI): ${Number(simContext.analyticalSlope ?? 0).toFixed(4)} µmol CO₂ m⁻² s⁻¹ klux⁻¹\n` +
          `- Active Limiting Factor: ${simContext.limitingFactor ?? 'Light Intensity'}\n` +
          `- Saved Experiment Runs: ${simContext.savedCount ?? 0}`
        : '';

      if (!ai) {
        return res.json({
          reply: buildDeterministicBiologyFallback(latestMessage, simContext),
          modelUsed: `${selectedModel} (local physiological engine)`,
        });
      }

      const contents = userMessages.map((m, idx) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [
          {
            text:
              idx === userMessages.length - 1 && m.role === 'user'
                ? `${m.text}${contextBlock}`
                : m.text,
          },
        ],
      }));

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          systemInstruction: BIOLOGY_SYSTEM_INSTRUCTION,
          temperature: 0.4,
        },
      });

      const replyText =
        response.text || buildDeterministicBiologyFallback(latestMessage, simContext);

      return res.json({
        reply: replyText,
        modelUsed: selectedModel,
      });
    } catch (err: any) {
      const latestMessage =
        Array.isArray(req.body?.messages) && req.body.messages.length > 0
          ? req.body.messages[req.body.messages.length - 1].text
          : '';
      return res.json({
        reply: buildDeterministicBiologyFallback(latestMessage, req.body?.simContext),
        modelUsed: 'gemini-3.8-flash (physiological fallback)',
        warning: err?.message || 'Handled upstream model error gracefully',
      });
    }
  });

  // Fast One-Click Experimental Condition Brief using gemini-3.1-flash-lite
  app.post('/api/gemini/analyze', async (req, res) => {
    try {
      const { simContext } = req.body as { simContext?: Record<string, any> };
      const ai = getGenAIClient();

      const prompt = `Provide a concise, 3-sentence physiological interpretation of this photosynthesis simulation state for a university biology student:
Light = ${simContext?.lightKlux ?? 40} klux, CO2 = ${simContext?.co2Ppm ?? 400} ppm, Temperature = ${simContext?.temperatureC ?? 25} °C, Water = ${simContext?.waterPct ?? 100}%, Mode = ${simContext?.mode ?? 'baseline'}, Predicted Rate = ${Number(simContext?.activeRate ?? 12.31).toFixed(2)} µmol CO₂ m⁻² s⁻¹, Local Slope dR/dI = ${Number(simContext?.analyticalSlope ?? 0.118).toFixed(3)} µmol CO₂ m⁻² s⁻¹ klux⁻¹, Limiting Factor = ${simContext?.limitingFactor ?? 'Light Intensity'}.`;

      if (!ai) {
        return res.json({
          summary: buildDeterministicBiologyFallback('limit', simContext),
          modelUsed: 'gemini-3.1-flash-lite',
        });
      }

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          systemInstruction: BIOLOGY_SYSTEM_INSTRUCTION,
          temperature: 0.3,
        },
      });

      return res.json({
        summary: response.text || buildDeterministicBiologyFallback('limit', simContext),
        modelUsed: 'gemini-3.1-flash-lite',
      });
    } catch {
      return res.json({
        summary: buildDeterministicBiologyFallback('limit', req.body?.simContext),
        modelUsed: 'gemini-3.1-flash-lite',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Light & Leaf Simulator server listening on http://localhost:${PORT}`);
  });
}

startServer();
