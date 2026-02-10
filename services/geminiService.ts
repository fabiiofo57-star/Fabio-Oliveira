
import { GoogleGenAI } from "@google/genai";
import { AppState } from "../types";

export async function getFinancialInsights(state: AppState) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return "Chave de API não encontrada. Por favor, verifique as configurações.";
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const incomeTotal = state.transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount), 0) + (Number(state.profile.monthlyIncome) || 0);
  
  const expenseTotal = state.transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const categoryBreakdown = state.transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const prompt = `
    DADOS FINANCEIROS (FB finance):
    Usuário: ${state.profile.name}
    Renda Base: ${state.profile.currency} ${Number(state.profile.monthlyIncome).toFixed(2)}
    Total de Entradas: ${state.profile.currency} ${incomeTotal.toFixed(2)}
    Total de Despesas: ${state.profile.currency} ${expenseTotal.toFixed(2)}
    Saldo Atual: ${state.profile.currency} ${(incomeTotal - expenseTotal).toFixed(2)}
    
    Categorias de gastos:
    ${Object.entries(categoryBreakdown).map(([cat, val]) => `- ${cat}: ${state.profile.currency} ${val.toFixed(2)}`).join('\n')}
    
    Metas:
    ${state.goals.map(g => `- ${g.name}: falta ${state.profile.currency} ${(Number(g.targetAmount) - Number(g.currentAmount)).toFixed(2)}`).join('\n')}

    Com base nestes dados reais, forneça 3 dicas curtas e motivadoras para economizar mais este mês.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: "Você é o assistente virtual do FB finance. Seja direto, motivador e use Português do Brasil. Analise os números e aponte onde o usuário pode cortar gastos para atingir suas metas.",
        temperature: 0.8,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Não foi possível analisar seus dados agora. Verifique sua conexão.";
  }
}
