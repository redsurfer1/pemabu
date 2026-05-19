"use client";
import * as Sentry from "@sentry/nextjs";
import { Component } from "react";

interface Props { children: React.ReactNode; title?: string; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundaryClient extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error) { Sentry.captureException(error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-red-400 text-sm mb-2">{this.props.title ?? "Something went wrong"}</p>
          <p className="text-gray-500 text-xs mb-4">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
