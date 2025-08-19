import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ImportProgressCardProps {
  progress: number; // 0-100
  recordsFound: number;
  created: number;
  updated: number;
  failed: number;
  isComplete?: boolean;
  className?: string;
}

export function ImportProgressCard({
  progress,
  recordsFound,
  created,
  updated,
  failed,
  isComplete = false,
  className
}: ImportProgressCardProps) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Card className={cn(
      "w-[280px] h-[320px] border-none bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-2xl",
      className
    )}>
      <CardContent className="flex flex-col items-center justify-center p-6 h-full">
        {/* Circular Progress */}
        <div className="relative mb-6">
          <svg
            className="w-32 h-32 transform -rotate-90 drop-shadow-lg"
            viewBox="0 0 120 120"
          >
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="4"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="white"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          
          {/* Progress percentage */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold mb-1">
            {isComplete ? '🎉 Import Complete!' : '⚡ Processing...'}
          </h3>
          <Badge
            variant="outline"
            className="border-white/30 text-white/90 bg-white/10"
          >
            {recordsFound.toLocaleString()} Records Found
          </Badge>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-3 w-full text-center">
          <div className="bg-white/10 rounded-lg p-2">
            <div className="text-lg font-bold text-green-300">
              {created.toLocaleString()}
            </div>
            <div className="text-xs text-white/80">Created</div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-2">
            <div className="text-lg font-bold text-blue-300">
              {updated.toLocaleString()}
            </div>
            <div className="text-xs text-white/80">Updated</div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-2">
            <div className={cn(
              "text-lg font-bold",
              failed > 0 ? "text-red-300" : "text-gray-300"
            )}>
              {failed.toLocaleString()}
            </div>
            <div className="text-xs text-white/80">Failed</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}