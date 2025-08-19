import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, Zap, TrendingUp, AlertCircle, Rocket, X } from 'lucide-react';

interface AwesomeImportToastProps {
  progress: number; // 0-100
  recordsFound: number;
  created: number;
  updated: number;
  failed: number;
  isComplete?: boolean;
  className?: string;
  onClose?: () => void;
}

export function AwesomeImportToast({
  progress,
  recordsFound,
  created,
  updated,
  failed,
  isComplete = false,
  className,
  onClose
}: AwesomeImportToastProps) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn(
      "relative w-[400px] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl shadow-2xl border border-purple-500/30 backdrop-blur-sm",
      className
    )}>
      {/* Properly rounded animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-pink-600/5 rounded-2xl" />
      
      <div className="relative p-6 text-white z-10 rounded-2xl">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Rocket className="h-6 w-6 text-blue-400" />
              {!isComplete && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping" />
              )}
            </div>
            <h3 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {isComplete ? 'Import Complete!' : 'Import in Progress'}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            {isComplete && (
              <CheckCircle className="h-6 w-6 text-green-400 animate-bounce" />
            )}
            {/* Large, visible close button */}
            {onClose && (
              <button
                onClick={onClose}
                className="ml-2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-200 group"
                aria-label="Close notification"
              >
                <X className="h-5 w-5 text-white/70 group-hover:text-white transition-colors duration-200" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Section */}
        <div className="flex items-center gap-4 mb-6">
          {/* Circular Progress */}
          <div className="relative">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="6"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="url(#progressGradient)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 ease-out"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="50%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Progress percentage */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Progress Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-blue-300 font-medium">
                {recordsFound.toLocaleString()} Records Found
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              </div>
            </div>
            
            <div className="text-xs text-gray-300">
              {isComplete ? '🎉 Processing Complete!' : '⚡ Processing at maximum speed...'}
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Created */}
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-3 border border-green-500/30">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-green-300 font-medium">Created</span>
            </div>
            <div className="text-xl font-bold text-green-400">
              {created.toLocaleString()}
            </div>
          </div>

          {/* Updated */}
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-3 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-xs text-blue-300 font-medium">Updated</span>
            </div>
            <div className="text-xl font-bold text-blue-400">
              {updated.toLocaleString()}
            </div>
          </div>

          {/* Failed */}
          <div className={cn(
            "bg-gradient-to-br rounded-xl p-3 border",
            failed > 0 
              ? "from-red-500/20 to-red-600/20 border-red-500/30" 
              : "from-gray-500/20 to-gray-600/20 border-gray-500/30"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <div className={cn(
                "w-2 h-2 rounded-full",
                failed > 0 ? "bg-red-400 animate-pulse" : "bg-gray-400"
              )} />
              <span className={cn(
                "text-xs font-medium",
                failed > 0 ? "text-red-300" : "text-gray-300"
              )}>
                Failed
              </span>
            </div>
            <div className={cn(
              "text-xl font-bold",
              failed > 0 ? "text-red-400" : "text-gray-400"
            )}>
              {failed.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Status Footer */}
        {isComplete && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-gray-300">
                Total Processed: <span className="font-bold text-white">{(created + updated + failed).toLocaleString()}</span>
              </span>
            </div>
          </div>
        )}

        {/* Simplified animated indicators for active state - moved to avoid close button */}
        {!isComplete && !onClose && (
          <div className="absolute top-4 right-4 flex gap-1">
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
            <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-1 h-1 bg-pink-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
      </div>
    </div>
  );
}
