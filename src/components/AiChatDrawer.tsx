/**
 * @file src/components/AiChatDrawer.tsx
 * @description Panel lateral desplegable de Chat IA nativo de Kurra Studio conectado al Command Bus
 * (Gemini, OpenAI, Anthropic, Ollama, proveedores compatibles con OpenAI o Asistente Local Determinista
 * sin clave). El historial es un `role="log"` con `aria-live`, y cada solicitud se puede detener.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronsDownUp, ChevronsUpDown, Cloud, Send, Settings, Square, Trash2, X, Zap } from 'lucide-react';
import { sendAiPrompt } from '../ai/aiClient';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { getAiBadgeDescriptor } from '../utils/aiBadges';
import { toolLabel } from '../utils/aiToolLabels';
import { useAiDrawerLayout } from './useAiDrawerLayout';
import { AiPanelTabs, type AiPanelTab } from './AiPanelTabs';
import '../styles/aiDrawer.css';

export const AiChatDrawer: React.FC = () => {
  const [input, setInput] = useState('');
  const [folded, setFolded] = useState(false);
  // Pestaña activa de la columna derecha en ventanas medias (901–1240 px); en otros anchos no se muestra.
  const [tab, setTab] = useState<AiPanelTab>('assistant');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
  const openSettings = useKuraStore((s) => s.openSettings);

  useAiDrawerLayout(aiDrawerOpen);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages.length, aiBusy]);

  // Al abrir el panel (y al terminar una respuesta) el foco vuelve al campo de texto.
  useEffect(() => {
    if (aiDrawerOpen && !aiBusy) inputRef.current?.focus();
  }, [aiDrawerOpen, aiBusy]);

  // Cada vez que se abre, el chat es la pestaña activa y no queda plegado.
  useEffect(() => {
    if (aiDrawerOpen) {
      setTab('assistant');
      setFolded(false);
    }
  }, [aiDrawerOpen]);

  // Cerrar el panel cancela la solicitud en curso.
  useEffect(() => {
    if (!aiDrawerOpen) abortRef.current?.abort();
  }, [aiDrawerOpen]);

  if (!aiDrawerOpen) {
    return null;
  }

  const aiBadge = getAiBadgeDescriptor(aiConfig, language);

  const submitPrompt = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || aiBusy) return;

    setInput('');
    addAiMessage({ role: 'user', content: trimmed });
    setAiBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const output = await sendAiPrompt(
        trimmed,
        aiMessages,
        aiConfig,
        language,
        executeCommand,
        { signal: controller.signal },
      );

      // El asistente local ya describe cada acción con su detalle: sin burbujas de herramienta duplicadas.
      for (const tool of output.usedLocalFallback ? [] : output.executedTools) {
        // Las lecturas de escena no son acciones: la respuesta ya trae las medidas en texto.
        if (tool.name === 'get_scene_state') continue;
        addAiMessage({
          role: 'tool',
          content: toolLabel(language, tool.name),
          toolName: tool.name,
          toolResult: tool.result,
        });
      }

      addAiMessage({
        role: 'assistant',
        content: output.assistantText,
      });
    } catch (err) {
      // Detener es una decisión del usuario, no un fallo: mensaje neutro, sin prefijo de error.
      const stopped = controller.signal.aborted || (err instanceof Error && err.name === 'AbortError');
      const message = err instanceof Error ? err.message : String(err);
      addAiMessage({
        role: 'assistant',
        content: stopped
          ? t(language, 'ai.chat.stopped')
          : t(language, 'toast.errorPrefix', { message }),
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setAiBusy(false);
    }
  };

  const stopPrompt = () => abortRef.current?.abort();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitPrompt(input);
  };

  const quickChips =
    language === 'en'
      ? [
          { label: t(language, 'ai.chip.box'), prompt: 'Create box 40mm' },
          { label: t(language, 'ai.chip.cylinder'), prompt: 'Create cylinder 20x50mm' },
          { label: t(language, 'ai.chip.hollow'), prompt: 'Hollow the selected object to 2.5 mm' },
          { label: t(language, 'ai.chip.export'), prompt: 'Export STL' },
        ]
      : [
          { label: t(language, 'ai.chip.box'), prompt: 'Crear cubo 40mm' },
          { label: t(language, 'ai.chip.cylinder'), prompt: 'Crear cilindro 20x50mm' },
          { label: t(language, 'ai.chip.hollow'), prompt: 'Ahueca el objeto seleccionado a 2,5 mm' },
          { label: t(language, 'ai.chip.export'), prompt: 'Exportar STL' },
        ];

  return (
    <>
    <AiPanelTabs active={tab} onChange={setTab} />
    <aside className={`kura-ai-drawer${folded ? ' is-folded' : ''}`} aria-label={t(language, 'ai.title')} data-viewport-occluder>
      <div className="kura-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Bot size={16} style={{ color: 'var(--tool-accent)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t(language, 'ai.title')}</div>
            <span
              className={`kura-ai-status-pill tone-${aiBadge.cssTone}`}
              title={aiBadge.tooltip}
            >
              {aiBadge.mode === 'external' ? (
                <Cloud size={11} />
              ) : aiBadge.mode === 'ollama' ? (
                <Bot size={11} />
              ) : (
                <Zap size={11} />
              )}
              <span>{aiBadge.label}</span>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className="kura-mini-icon-btn kura-ai-fold-btn"
            aria-expanded={!folded}
            onClick={() => setFolded((v) => !v)}
            aria-label={t(language, folded ? 'uxm.ai.expand' : 'uxm.ai.collapse')}
            title={t(language, folded ? 'uxm.ai.expand' : 'uxm.ai.collapse')}
          >
            {folded ? <ChevronsUpDown size={14} aria-hidden="true" /> : <ChevronsDownUp size={14} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="kura-mini-icon-btn"
            onClick={() => openSettings('ai')}
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

      <div className={`kura-privacy-strip tone-${aiBadge.cssTone}`}>
        {aiBadge.tooltip}
      </div>

      <div
        className="kura-chat-messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label={t(language, 'ai.chatLog')}
        aria-busy={aiBusy}
      >
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
                  {toolLabel(language, msg.toolName)}
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
              {msg.id === 'welcome' ? t(language, 'ai.welcome') : msg.content}
            </div>
          );
        })}
        {aiBusy && (
          <div className="kura-chat-bubble assistant" style={{ opacity: 0.7 }} role="status">
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
          ref={inputRef}
          className="kura-input"
          style={{ flex: 1 }}
          placeholder={t(language, 'ai.placeholder')}
          aria-label={t(language, 'ai.title')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={aiBusy}
        />
        {aiBusy ? (
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            onClick={stopPrompt}
            aria-label={t(language, 'ai.stop')}
            title={t(language, 'ai.stop')}
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            type="submit"
            className="kura-btn kura-btn-primary kura-btn-sm"
            disabled={!input.trim()}
            aria-label={t(language, 'ai.send')}
            title={t(language, 'ai.send')}
          >
            <Send size={14} />
          </button>
        )}
      </form>
    </aside>
    </>
  );
};
