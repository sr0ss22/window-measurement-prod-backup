import type { ProjectRecord } from "@/types/project";
import { Ruler, Wrench, RefreshCw } from "lucide-react";

interface WorkTypeIconProps {
  project: ProjectRecord;
  className?: string;
}

export const WorkTypeIcon = ({ project, className = "h-4 w-4 text-gray-500" }: WorkTypeIconProps) => {
  const workType = project.work_type || project.details?.work_type;
  if (!workType) return null;

  const lowerCaseWorkType = workType.toLowerCase();

  if (lowerCaseWorkType.includes('measure')) {
    return <Ruler className={className} title="Measure" />;
  }
  if (lowerCaseWorkType.includes('install')) {
    return <Wrench className={className} title="Install" />;
  }
  if (lowerCaseWorkType.includes('service')) {
    return <RefreshCw className={className} title="Service Call" />;
  }
  
  return null;
};