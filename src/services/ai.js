import Groq from "groq-sdk";// Serviço de integração com Groq para geração de respostas IA

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function gerarRespostaIA(message, contexto = "") {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Você é um assistente inteligente de um sistema de gestão de vendas. Responda sempre em português de forma clara e objetiva.

Aqui estão os dados atuais do sistema para você usar nas respostas:
${contexto}

Use esses dados para responder perguntas sobre produtos, vendas e relatórios. Se o usuário perguntar algo que não está nos dados, diga que não tem essa informação disponível.`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      max_tokens: 1024,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Erro Groq:", error.message);
    throw error;
  }
}