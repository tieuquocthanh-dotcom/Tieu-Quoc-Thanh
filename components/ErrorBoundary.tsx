
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border-2 border-red-100 p-8 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
              <AlertTriangle className="text-red-600" size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase mb-2">Đã có lỗi xảy ra</h1>
            <p className="text-slate-600 mb-6">
              Ứng dụng gặp sự cố không mong muốn. Vui lòng thử tải lại trang hoặc liên hệ hỗ trợ.
            </p>
            
            {this.state.error && (
              <div className="bg-red-50 rounded-xl p-4 mb-6 text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-red-700 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-black uppercase shadow-lg transition transform active:scale-95 flex items-center justify-center"
            >
              <RefreshCw className="mr-2" size={20} />
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
