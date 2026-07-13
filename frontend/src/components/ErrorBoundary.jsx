import React from "react";

/**
 * Top-level React error boundary. Prevents any unhandled render error from
 * blanking the entire page (a class-2 SPA failure mode we hit on production
 * for the admin SMS settings screen). Logs the error and shows a friendly
 * recovery UI with a Reload button.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Something went wrong." };
  }

  componentDidCatch(error, info) {
    // Emit to console so we still catch it in production error trackers.
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, message: "" });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        data-testid="app-error-boundary"
        className="min-h-screen w-full flex items-center justify-center bg-cream px-6"
      >
        <div className="max-w-md w-full bg-white border border-cream-300 rounded-2xl p-6 text-center shadow-lg">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.732-3L13.732 4a2 2 0 00-3.464 0L3.268 16A2 2 0 005 19z" />
            </svg>
          </div>
          <h1 className="font-heading font-bold text-lg text-ink mb-1">Something went wrong</h1>
          <p className="text-sm text-ink-soft mb-4 break-words">
            {this.state.message}
          </p>
          <button
            data-testid="app-error-reload-btn"
            onClick={this.handleReload}
            className="bg-forest text-cream-100 font-bold px-5 py-2.5 rounded-xl hover:bg-forest-dark"
          >
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
