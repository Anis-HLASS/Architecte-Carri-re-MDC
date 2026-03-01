/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  FileText, 
  Target, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  User, 
  Bot,
  ChevronRight,
  ClipboardCheck,
  Paperclip,
  X
} from 'lucide-react';
import { AppStep, Message, UserData } from './types';
import { getChatResponse, analyzeCV, generateLaTeX } from './services/gemini';

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.ACQUISITION);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<UserData>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial Greeting
  useEffect(() => {
    const greeting = "Bonjour ! Je suis l'Architecte Carrière MDC. Je vais vous accompagner pour créer un CV d'excellence, optimisé pour les logiciels ATS et conforme aux standards de la 'Maison des Cadres'.\n\nSouhaitez-vous construire votre CV de zéro en me décrivant votre parcours, ou possédez-vous déjà une version existante (à coller ici ou à uploader en PDF) ?";
    setMessages([{ role: 'assistant', content: greeting, timestamp: Date.now() }]);
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSend = async (overrideInput?: string) => {
    // Ensure messageText is a string. If overrideInput is an event or undefined, fallback to input.
    const messageText = (typeof overrideInput === 'string') ? overrideInput : input;
    
    if ((!messageText.trim() && !selectedFile) || isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: selectedFile ? `[Fichier: ${selectedFile.name}] ${messageText}` : messageText, 
      timestamp: Date.now() 
    };
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = messageText;
    const currentFile = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      // Use a local copy of userData to avoid stale state issues within the same function call
      let updatedUserData = { ...userData };

      if (step === AppStep.ACQUISITION) {
        let fileData;
        if (currentFile) {
          const base64 = await fileToBase64(currentFile);
          fileData = { data: base64, mimeType: currentFile.type };
        }
        
        updatedUserData.rawCvText = currentInput;
        setUserData(updatedUserData);

        const analysis = await analyzeCV(currentInput, fileData);
        setMessages(prev => [...prev, { role: 'assistant', content: analysis, timestamp: Date.now() }]);
        setStep(AppStep.ANALYSIS);
      } else if (step === AppStep.ANALYSIS) {
        if (currentInput.toLowerCase() === 'passer') {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "Très bien. Passons à l'étape suivante. Veuillez me fournir le lien, le texte ou la description de l'offre d'emploi que vous visez.", 
            timestamp: Date.now() 
          }]);
          setStep(AppStep.TARGETING);
        } else {
          let fileData;
          if (currentFile) {
            const base64 = await fileToBase64(currentFile);
            fileData = { data: base64, mimeType: currentFile.type };
          }
          
          updatedUserData.additionalInfo = (updatedUserData.additionalInfo || '') + '\n' + currentInput;
          setUserData(updatedUserData);
          const nextAnalysis = await analyzeCV(updatedUserData.rawCvText + '\n' + currentInput, fileData);
          setMessages(prev => [...prev, { role: 'assistant', content: nextAnalysis + "\n\n(Tapez 'Passer' pour passer à l'offre d'emploi)", timestamp: Date.now() }]);
        }
      } else if (step === AppStep.TARGETING) {
        updatedUserData.jobOfferText = currentInput;
        setUserData(updatedUserData);
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "C'est noté. Maintenant, une étape cruciale : veuillez me copier-coller le code de votre **Template LaTeX** (l'exemple de design que vous souhaitez suivre). Je m'en servirai pour injecter votre contenu optimisé.", 
          timestamp: Date.now() 
        }]);
        setStep(AppStep.TEMPLATE);
      } else if (step === AppStep.TEMPLATE) {
        updatedUserData.latexTemplate = currentInput;
        setUserData(updatedUserData);

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "Parfait. Je génère votre CV optimisé dans votre template. Cela peut prendre quelques instants...", 
          timestamp: Date.now() 
        }]);
        setStep(AppStep.GENERATION);
        
        const latex = await generateLaTeX(updatedUserData);
        updatedUserData.latexCode = latex;
        setUserData(updatedUserData);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "Voici votre CV finalisé, intégré dans votre template et optimisé selon les règles de la Maison des Cadres.\n\n" + latex, 
          timestamp: Date.now() 
        }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur est survenue lors du traitement.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        alert("Veuillez uploader un fichier au format PDF. Les fichiers Word ne sont pas supportés directement par l'analyseur.");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    const latexMatch = text.match(/```latex([\s\S]*?)```/);
    const content = latexMatch ? latexMatch[1].trim() : text;
    navigator.clipboard.writeText(content);
    alert("Code LaTeX copié !");
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white overflow-hidden">
            <img 
              src="https://picsum.photos/seed/mdc-career/200/200" 
              alt="Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Architecte Carrière MDC</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Expertise Maison des Cadres</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-4">
          <StepItem active={step === AppStep.ACQUISITION} done={step !== AppStep.ACQUISITION} label="Acquisition" icon={<FileText size={16} />} number={1} />
          <ChevronRight size={14} className="text-slate-300" />
          <StepItem active={step === AppStep.ANALYSIS} done={step !== AppStep.ACQUISITION && step !== AppStep.ANALYSIS} label="Analyse" icon={<AlertCircle size={16} />} number={2} />
          <ChevronRight size={14} className="text-slate-300" />
          <StepItem active={step === AppStep.TARGETING} done={step === AppStep.TEMPLATE || step === AppStep.GENERATION} label="Ciblage" icon={<Target size={16} />} number={3} />
          <ChevronRight size={14} className="text-slate-300" />
          <StepItem active={step === AppStep.TEMPLATE} done={step === AppStep.GENERATION} label="Template" icon={<ClipboardCheck size={16} />} number={4} />
          <ChevronRight size={14} className="text-slate-300" />
          <StepItem active={step === AppStep.GENERATION} done={false} label="Génération" icon={<CheckCircle2 size={16} />} number={5} />
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600'
              }`}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
              }`}>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content.includes('```latex') ? (
                    <div className="space-y-4">
                      <p>Votre code LaTeX est prêt :</p>
                      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                        {msg.content.match(/```latex([\s\S]*?)```/)?.[1] || msg.content}
                      </pre>
                      <button 
                        onClick={() => copyToClipboard(msg.content)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <Download size={16} /> Copier le code LaTeX
                      </button>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm">
              <p className="text-slate-400 italic text-sm">L'expert analyse vos informations...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        
        {step === AppStep.ANALYSIS && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <button 
              onClick={() => handleSend('Passer')}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-indigo-200 text-indigo-600 rounded-2xl font-semibold shadow-sm hover:bg-indigo-50 transition-all"
            >
              <Target size={18} /> Passer à l'offre d'emploi
            </button>
          </motion.div>
        )}

        {step === AppStep.TARGETING && !isLoading && userData.jobOfferText && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <button 
              onClick={() => handleSend(userData.jobOfferText)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
            >
              <ChevronRight size={18} /> Passer au Template LaTeX
            </button>
          </motion.div>
        )}

        {step === AppStep.TEMPLATE && !isLoading && userData.latexTemplate && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <button 
              onClick={() => handleSend(userData.latexTemplate)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
            >
              <CheckCircle2 size={18} /> Générer mon CV optimisé
            </button>
          </motion.div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-4 md:p-8 max-w-4xl mx-auto w-full">
        {selectedFile && (
          <div className="mb-2 flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm border border-indigo-100 animate-in fade-in slide-in-from-bottom-2">
            <FileText size={16} />
            <span className="font-medium truncate max-w-[200px]">{selectedFile.name}</span>
            <button onClick={() => setSelectedFile(null)} className="ml-auto hover:bg-indigo-200 p-1 rounded-full transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              step === AppStep.ACQUISITION ? "Décrivez votre parcours ou uploadez votre CV..." :
              step === AppStep.ANALYSIS ? "Répondez aux questions ou tapez 'Passer'..." :
              step === AppStep.TARGETING ? "Collez l'offre d'emploi visée..." :
              step === AppStep.TEMPLATE ? "Collez votre code Template LaTeX ici..." :
              "Votre CV a été généré."
            }
            disabled={isLoading || (step === AppStep.GENERATION && userData.latexCode !== undefined)}
            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 pr-24 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none min-h-[60px] max-h-[200px]"
            rows={1}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            {(step === AppStep.ACQUISITION || step === AppStep.ANALYSIS) && (
              <>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                  title="Uploader un CV (PDF uniquement)"
                >
                  <Paperclip size={20} />
                </button>
              </>
            )}
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !selectedFile) || isLoading}
              className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/20"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-4 uppercase tracking-widest font-semibold">
          Propulsé par Gemini AI • Conforme Maison des Cadres
        </p>
      </footer>
    </div>
  );
}

function StepItem({ active, done, label, icon, number }: { active: boolean; done: boolean; label: string; icon: React.ReactNode; number: number }) {
  return (
    <div className={`flex items-center gap-2 transition-colors ${active ? 'text-indigo-600' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-[10px] font-bold ${
        active ? 'border-indigo-600 bg-indigo-50' : done ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'
      }`}>
        {done ? <CheckCircle2 size={14} /> : number}
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}
