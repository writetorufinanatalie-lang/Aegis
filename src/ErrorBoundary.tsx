import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Catches any render-time error anywhere below it and shows a real, actionable screen instead
 * of a blank white page. React error boundaries only catch render/lifecycle errors (not errors
 * inside async handlers or event callbacks — those are handled per-action with try/catch
 * elsewhere), but a render crash is exactly the case that otherwise produces a blank page, so
 * this is the backstop for that.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[AEGIS] Unhandled render error:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.hash = "";
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="entry-screen">
        <section className="entry-panel" role="alert">
          <div className="eyebrow">AEGIS / SOMETHING WENT WRONG</div>
          <h1>This page hit an unexpected error.</h1>
          <p>Nothing about your session was lost. Reloading usually fixes this — if it keeps happening, your synthetic demo session may be out of date.</p>
          <button className="primary" onClick={this.handleReload}>Reload AEGIS</button>
          <small>{this.state.error.message}</small>
        </section>
      </div>
    );
  }
}
