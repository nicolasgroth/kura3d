/**
 * @file src/components/AiChatDrawer.tsx
 * @description Panel lateral desplegable de Chat IA nativo de Kura3D conectado al Command Bus
 * (Gemini, OpenAI, Anthropic, Ollama o Asistente Local Determinista sin API Key).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Settings, Trash2, X } from 'lucide-react';
import { sendAiPrompt } from '../ai/aiClient';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';

export const AiChatDrawer: React.FC = () => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const language = useKuraStore((s) => s.language);
  const aiDrawerOpen = useKuraStore((s) => s.aiDrawerOpen);
  const setAiDrawerOpen = useKuraStore((s) => s.setAiDrawerOpen);
  const aiConfig = useKuraStore((s) => s.aiConfig);
  const aiMessages = useKuraStore((s) => s.aiMessages);
  const aiBusy = useKuraStore((s) => s.aiBusy);
  const addAiMessage = useKuraStore((s) => s.addAiMessage);
  const clearAiMessages = useKuraStore((s) => s.clearAiMessages);
  const setAiBusy = useKuraStore((s) => s.setAiBusy);
  const executeCommand = useKuraStore((s) => s.executeCommand);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages.length, aiBusy]);

  if (!aiDrawerOpen) {
    return null;
  }

  const hasRemoteKey =
    aiConfig.provider === 'ollama' || Boolean(aiConfig.apiKey.trim());

  const providerBadgeText = hasRemoteKey
    ? `${aiConfig.provider.toUpperCase()} · ${aiConfig.model || 'auto'}`
    : t(language, 'ai.providerOffline');

  const submitPrompt = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || aiBusy) return;

    setInput('');
    addAiMessage({ role: 'user', content: trimmed });
    setAiBusy(true);

    try {
      const output = await sendAiPrompt(
        trimmed,
        aiMessages,
        aiConfig,
        language,
        executeCommand,
      );

      for (const tool of output.executedTools) {
        addAiMessage({
          role: 'tool',
          content: `${t(language, 'ai.toolBadge')}: ${tool.name}\n${tool.result}`,
          toolName: tool.name,
          toolResult: tool.result,
        });
      }

      addAiMessage({
        role: 'assistant',
        content: output.assistantText,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addAiMessage({
        role: 'assistant',
        content: t(language, 'toast.errorPrefix', { message }),
      });
    } finally {
      setAiBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitPrompt(input);
  };

  const quickChips =
    language === 'en'
      ? [
          { label: t(language, 'ai.chip.box'), prompt: 'Create box 40mm' },
          { label: t(language, 'ai.chip.cylinder'), prompt: 'Create cylinder 20x50mm' },
          { label: t(language, 'ai.chip.hollow'), prompt: 'Hollow selected object 2.5mm' },
          { label: t(language, 'ai.chip.export'), prompt: 'Export STL' },
        ]
      : [
          { label: t(language, 'ai.chip.box'), prompt: 'Crear cubo 40mm' },
          { label: t(language, 'ai.chip.cylinder'), prompt: 'Crear cilindro 20x50mm' },
          { label: t(language, 'ai.chip.hollow'), prompt: 'Ahuecar a 2.5mm' },
          { label: t(language, 'ai.chip.export'), prompt: 'Exportar STL' },
        ];

  return (
    <aside className="kura-ai-drawer" aria-label={t(language, 'ai.title')}>
      <div className="kura-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={16} style={{ color: 'var(--accent-cyan)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t(language, 'ai.title')}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
              {providerBadgeText}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className="kura-mini-icon-btn"
            onClick={() => setActiveDialog('settings')}
            title={t(language, 'ai.configureKey')}
          >
            <Settings size={14} />
          </button>
          <button
            type="button"
            className="kura-mini-icon-btn"
            onClick={clearAiMessages}
            title={t(language, 'ai.clearChat')}
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            className="kura-mini-icon-btn"
            onClick={() => setAiDrawerOpen(false)}
            title={t(language, 'dialog.close')}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="kura-chat-messages">
        {aiMessages.map((msg) => {
          if (msg.role === 'tool') {
            let formattedJson = msg.toolResult ?? msg.content;
            if (msg.toolResult) {
              try {
                formattedJson = JSON.stringify(JSON.parse(msg.toolResult), null, 2);
              } catch {
                formattedJson = msg.toolResult;
              }
            }
            return (
              <div key={msg.id} className="kura-chat-bubble tool">
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {t(language, 'ai.toolBadge')}: {msg.toolName ?? 'command'}
                </div>
                <details className="kura-tool-details">
                  <summary>{t(language, 'ai.technicalDetails')}</summary>
                  <pre className="kura-tool-json">{formattedJson}</pre>
                </details>
              </div>
            );
          }
          return (
            <div key={msg.id} className={`kura-chat-bubble ${msg.role}`}>
              {msg.content}
            </div>
          );
        })}
        {aiBusy && (
          <div className="kura-chat-bubble assistant" style={{ opacity: 0.7 }}>
            {t(language, 'ai.thinking')}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="kura-chat-chips">
        {quickChips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="kura-chip"
            disabled={aiBusy}
            onClick={() => void submitPrompt(chip.prompt)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <form className="kura-chat-form" onSubmit={handleSubmit}>
        <input
          className="kura-input"
          style={{ flex: 1 }}
          placeholder={t(language, 'ai.placeholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={aiBusy}
        />
        <button
          type="submit"
          className="kura-btn kura-btn-primary kura-btn-sm"
          disabled={aiBusy || !input.trim()}
          aria-label={t(language, 'ai.send')}
        >
          <Send size={14} />
        </button>
      </form>
    </aside>
  );
};
