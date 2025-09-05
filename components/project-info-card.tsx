"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, MapPin, Phone, Hash, Mail } from "lucide-react"
import type { ProjectRecord } from "@/types/project"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ProjectInfoCardProps {
  project: ProjectRecord | null
  isLoading: boolean
  className?: string
}

export function ProjectInfoCard({ project, isLoading, className }: ProjectInfoCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("border-2 border-gray-200", className)}>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
        </CardContent>
      </Card>
    )
  }

  if (!project) {
    return (
      <Card className={cn("border-2 border-gray-200", className)}>
        <CardHeader>
          <CardTitle className="text-xl text-gray-800">Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No project data available.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("border-2 border-gray-200", className)}>
      <CardHeader>
        {/* Removed CardTitle "Project Information" */}
      </CardHeader>
      <CardContent className="space-y-2 text-gray-700">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-charcoal" />
          <span className="font-medium">{project.customer_name || "N/A"}</span>
        </div>
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-charcoal" />
          <span>{project.address || "No address provided"}</span>
        </div>
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-charcoal" />
          <span>{project.phone || "No phone provided"}</span>
        </div>
        {project.customer_contact_info?.email && (
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-charcoal" />
            <span>{project.customer_contact_info.email}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Hash className="h-5 w-5 text-charcoal" />
          <span>WO#: {project.work_order_number || "N/A"}</span>
        </div>
      </CardContent>
    </Card>
  )
}