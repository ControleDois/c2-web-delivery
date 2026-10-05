// Alerta sonoro de novo pedido (Web Audio, sem arquivo de som).
//
// O navegador só deixa tocar áudio depois de uma interação do usuário na
// página. Por isso há UM contexto de áudio compartilhado, destravado no
// primeiro clique/toque/tecla — se a página for recarregada com o som já
// "ligado", o alerta fica mudo até alguém interagir, e a tela avisa isso.

type AudioCtor = typeof AudioContext

let context: AudioContext | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function getContext(): AudioContext | null {
  if (context) return context
  const Ctor: AudioCtor | undefined =
    window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
  if (!Ctor) return null
  context = new Ctor()
  context.onstatechange = notify
  return context
}

export function audioUnlocked(): boolean {
  return context?.state === 'running'
}

export function subscribeAudioState(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function unlockAudio(): Promise<boolean> {
  const ctx = getContext()
  if (!ctx) return false
  if (ctx.state !== 'running') {
    try {
      await ctx.resume()
    } catch {
      return false
    }
  }
  notify()
  return ctx.state === 'running'
}

// Três notas (campainha), bem mais alto que um bipe simples.
export function playAlert() {
  const ctx = context
  if (!ctx || ctx.state !== 'running') return false
  const notes = [
    { frequency: 880, start: 0 },
    { frequency: 1175, start: 0.24 },
    { frequency: 1568, start: 0.48 },
  ]
  for (const note of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const begin = ctx.currentTime + note.start
    osc.type = 'triangle'
    osc.frequency.value = note.frequency
    gain.gain.setValueAtTime(0.0001, begin)
    gain.gain.exponentialRampToValueAtTime(0.6, begin + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, begin + 0.22)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(begin)
    osc.stop(begin + 0.24)
  }
  return true
}
