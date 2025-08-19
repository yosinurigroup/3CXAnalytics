import React from 'react';
import { CheckCircle, Clock, Loader2, Rocket, BarChart3, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimelineStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  icon?: React.ReactNode;
  timestamp?: string;
}

export interface ImportStats {
  created: number;
  updated: number;
  failed: number;
  total: number;
  throughput?: number;
  duration?: number;
}

interface TimelineToastProps {
  steps: TimelineStep[];
  stats?: ImportStats;
  className?: string;
}

export function TimelineToast({ steps, stats, className }: TimelineToastProps) {
  const getStepIcon = (step: TimelineStep) => {
    if (step.icon) return step.icon;
    
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'active':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <div className="h-4 w-4 rounded-full bg-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStepLineColor = (step: TimelineStep, isLast: boolean) => {
    if (isLast) return '';
    
    switch (step.status) {
      case 'completed':
        return 'bg-green-500';
      case 'active':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <div className={cn("w-full max-w-md", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-sm">Import Progress Timeline</h3>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-3 mb-4">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="relative flex items-start gap-3">
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-2 top-6 w-0.5 h-6 bg-gray-200">
                  <div 
                    className={cn(
                      "w-full transition-all duration-500",
                      getStepLineColor(step, isLast)
                    )}
                    style={{
                      height: step.status === 'completed' ? '100%' : 
                              step.status === 'active' ? '50%' : '0%'
                    }}
                  />
                </div>
              )}
              
              {/* Step icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getStepIcon(step)}
              </div>
              
              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "text-sm font-medium",
                    step.status === 'completed' && "text-green-700",
                    step.status === 'active' && "text-blue-700",
                    step.status === 'error' && "text-red-700",
                    step.status === 'pending' && "text-gray-500"
                  )}>
                    {step.title}
                  </p>
                  {step.timestamp && (
                    <span className="text-xs text-gray-400">{step.timestamp}</span>
                  )}
                </div>
                <p className={cn(
                  "text-xs mt-1",
                  step.status === 'completed' && "text-green-600",
                  step.status === 'active' && "text-blue-600",
                  step.status === 'error' && "text-red-600",
                  step.status === 'pending' && "text-gray-400"
                )}>
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Statistics */}
      {stats && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-700">Import Statistics</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="font-medium text-green-600">{stats.created.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Updated:</span>
              <span className="font-medium text-blue-600">{stats.updated.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Failed:</span>
              <span className="font-medium text-red-600">{stats.failed.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total:</span>
              <span className="font-medium text-gray-800">{stats.total.toLocaleString()}</span>
            </div>
            
            {stats.throughput && (
              <div className="flex justify-between col-span-2 pt-1 border-t">
                <span className="text-gray-600 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Throughput:
                </span>
                <span className="font-medium text-orange-600">
                  {stats.throughput.toFixed(1)} records/sec
                </span>
              </div>
            )}
            
            {stats.duration && (
              <div className="flex justify-between col-span-2">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium text-gray-800">
                  {(stats.duration / 1000).toFixed(1)}s
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}