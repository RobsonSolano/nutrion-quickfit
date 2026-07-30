import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; onReset: () => void };
type State = { crashed: boolean };

/**
 * Último recurso. Se algo não previsto lançar durante o render, o totem volta
 * para a tela inicial em 5 segundos em vez de ficar branco até alguém notar.
 */
export class Boundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Erro não tratado no totem:', error);
    window.setTimeout(() => {
      this.setState({ crashed: false });
      this.props.onReset();
    }, 5000);
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
        <h2 className="font-display text-[44px] font-extrabold tracking-tight">
          Algo deu errado
        </h2>
        <p className="max-w-[26ch] text-[24px] text-dim">
          Voltando ao início em alguns segundos. Se persistir, procure a recepção.
        </p>
      </div>
    );
  }
}
