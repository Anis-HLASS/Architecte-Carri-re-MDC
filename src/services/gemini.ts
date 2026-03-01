import { GoogleGenAI, Type } from "@google/genai";
import { AppStep, Message, UserData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_INSTRUCTION = `Tu es un Expert Senior en recrutement et en rédaction de CV. Tu maîtrises parfaitement :
- L'optimisation pour les logiciels ATS (Applicant Tracking System) avec un objectif strict de taux de matching > 92%.
- Le langage de formatage LaTeX et les structures de templates du site Overleaf.com.
- Les techniques de rédaction et de mise en page selon les consignes strictes de la "Maison des Cadres".
Ton ton est professionnel, bienveillant, guidant et orienté résultat.

CONSIGNES STRICTES "MAISON DES CADRES" ET DÉONTOLOGIE :
1. ZÉRO INVENTION (RÈGLE ABSOLUE) : N'invente aucune expérience, aucune tâche, ni aucune compétence. Adapte et optimise le contenu STRICTEMENT à partir du CV enrichi fourni par l'utilisateur.
2. Format et Longueur : 1 seule page A4.
3. Typographie : Une seule police. AUCUN point final "." à la fin des phrases. AUCUNE parenthèse "()". Gras limité à 3-5 mots clés par section.
4. Entête : Prénom, NOM, Ville, Téléphone, Email, LinkedIn. PAS d'âge, situation familiale ou nationalité.
5. Titre : Doit correspondre ou être adapté au titre du poste visé.
6. Accroche : 3 LIGNES MAXIMUM. Sous la formule… je vous accompagne pour faire ..ou je vous aide à réaliser …etc.
7. Expériences : Ordre anti-chronologique. Verbes d'action. Résultats chiffrés.
8. Centres d'intérêt : Pas de religion, politique ou syndicalisme.`;

export async function analyzeCV(cvText: string, fileData?: { data: string, mimeType: string }): Promise<string> {
  const parts: any[] = [{ text: `Analyse ce CV et identifie les anomalies (trous, manque de chiffres, descriptions incomplètes). Pose des questions ciblées pour enrichir le profil. CV: ${cvText}` }];
  
  if (fileData) {
    parts.push({
      inlineData: {
        data: fileData.data,
        mimeType: fileData.mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
  return response.text || "Désolé, je n'ai pas pu analyser votre CV.";
}

export async function generateLaTeX(userData: UserData): Promise<string> {
  const prompt = `Génère le code LaTeX final pour ce CV en utilisant IMPÉRATIVEMENT le template fourni ci-dessous.
  
  TEMPLATE LATEX À UTILISER :
  ${userData.latexTemplate}
  
  DONNÉES CV :
  ${userData.rawCvText}
  
  OFFRE D'EMPLOI (CIBLAGE) :
  ${userData.jobOfferText}
  
  INFOS COMPLÉMENTAIRES :
  ${userData.additionalInfo}
  
  RÈGLES D'OR À APPLIQUER DANS LE TEXTE (SANS CASSER LA SYNTAXE LATEX) :
  1. ZÉRO INVENTION : N'invente rien, base-toi uniquement sur les compétences et tâches réelles du CV enrichi.
  2. Matching ATS > 92%
  3. AUCUN point final "." à la fin des phrases ou des puces.
  4. AUCUNE parenthèse "()" (utiliser des deux-points ":" ou des virgules ",").
  5. Gras limité à 3-5 mots clés par section.
  6. Accroche 3 LIGNES MAXIMUM. Utiliser la formule "je vous accompagne pour faire..." ou "je vous aide à réaliser...".
  7. Titre du CV = Titre exact du poste visé.
  8. Conserver scrupuleusement l'architecture, les packages et le design du template fourni.
  
  FOURNIS UNIQUEMENT LE CODE LATEX COMPLET ET FINALISÉ DANS UN BLOC DE CODE.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
  return response.text || "";
}

export async function getChatResponse(messages: Message[], step: AppStep): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION + `\n\nÉtape actuelle du workflow: ${step}. Guide l'utilisateur selon le workflow défini.`,
    },
  });
  return response.text || "Une erreur est survenue.";
}
