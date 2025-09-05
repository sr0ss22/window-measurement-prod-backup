"use client"

import { useWindowContext } from "@/context/window-context"
import { formatMeasurement } from "@/utils/measurements"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Ruler, Box } from "lucide-react" // Add Box
import { Badge } from "@/components/ui/badge"
import { useMobile } from "@/hooks/use-mobile"
import { useState, useEffect } from "react"
import { useFormConfig } from "@/context/form-config-context"
import { useAuth } from "@/context/unified-auth-context"
import { toast } from "@/components/ui/use-toast"
import { GlobalFormSection } from "./global-form-section"
import { validateGlobalData } from "@/utils/validation"
import { ProjectInfoCard } from "./project-info-card"
import type { ProjectRecord } from "@/types/project"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export function WindowSummary() {
  const { state, updateGlobalFormData } = useWindowContext()
  const { state: formConfigState } = useFormConfig()
  const { supabase } = useAuth();
  const isMobile = useMobile()
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      if (!state.defaultProjectId) {
        setIsProjectLoading(false);
        return;
      }
      setIsProjectLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', state.defaultProjectId)
        .single();

      if (error) {
        console.error("Error fetching project for summary:", error);
        toast({ title: "Error", description: "Could not load project details.", variant: "destructive" });
        setProject(null);
      } else {
        setProject(data as ProjectRecord);
      }
      setIsProjectLoading(false);
    };

    fetchProject();
  }, [state.defaultProjectId, supabase]);

  // Count windows with wizard measurements
  const windowsWithWizardMeasurements = state.windowItems.filter(
    (w) =>
      w.wizardMeasurements &&
      ((w.wizardMeasurements.widths?.T ?? 0) > 0 ||
        (w.wizardMeasurements.widths?.M ?? 0) > 0 ||
        (w.wizardMeasurements.widths?.B ?? 0) > 0 ||
        (w.wizardMeasurements.heights?.L ?? 0) > 0 ||
        (w.wizardMeasurements.heights?.C ?? 0) > 0 ||
        (w.wizardMeasurements.heights?.R ?? 0) > 0)
  ).length

  // Get global form fields for validation
  const allGlobalFields = formConfigState.config.sections
    .filter(section => section.isLineItemSection === false)
    .flatMap(section => section.rows.flatMap(row => row.fields));

  return (
    <div className="space-y-6">
      {/* Project Information Card - Now Collapsible */}
      <Accordion type="single" collapsible className="w-full shadow-md rounded-xl">
        <AccordionItem value="project-info" className="border-none">
          <AccordionTrigger className="px-4 py-3 text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <Box className="h-5 w-5 text-primary" />
              Project Information
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <ProjectInfoCard project={project} isLoading={isProjectLoading} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Summary Statistics - Made more compact */}
      <div className="p-4 bg-gray-100 rounded-lg shadow-md"> {/* Added shadow-md here */}
        <h3 className="font-bold text-lg mb-2">Summary Statistics</h3>
        <div className="flex overflow-x-auto space-x-4 pb-2 scrollbar-hide">
          <div className="flex-shrink-0 bg-white p-4 rounded-lg shadow-sm min-w-[150px]">
            <div className="text-sm text-gray-500">Total Windows</div>
            <div className="text-2xl font-bold text-charcoal">{state.windowItems.length}</div>
          </div>
          <div className="flex-shrink-0 bg-white p-4 rounded-lg shadow-sm min-w-[150px]">
            <div className="text-sm text-gray-500">Inside Mount</div>
            <div className="text-2xl font-bold text-charcoal">
              {state.windowItems.filter((w) => w.mountType === "inside").length}
            </div>
          </div>
          <div className="flex-shrink-0 bg-white p-4 rounded-lg shadow-sm min-w-[150px]">
            <div className="text-sm text-gray-500">Outside Mount</div>
            <div className="text-2xl font-bold text-charcoal">
              {state.windowItems.filter((w) => w.mountType === "outside").length}
            </div>
          </div>
          <div className="flex-shrink-0 bg-white p-4 rounded-lg shadow-sm min-w-[150px]">
            <div className="text-sm text-gray-500">With Images</div>
            <div className="text-2xl font-bold text-charcoal">
              {state.windowItems.filter((w) => w.image !== null).length}
            </div>
          </div>
          <div className="flex-shrink-0 bg-white p-4 rounded-lg shadow-sm min-w-[150px]">
            <div className="text-sm text-gray-500">With Wizard Data</div>
            <div className="text-2xl font-bold text-charcoal">{windowsWithWizardMeasurements}</div>
          </div>
        </div>
      </div>

      {/* Window Measurements Table */}
      <div className="overflow-x-auto rounded-t-lg overflow-hidden"> {/* Added rounded-t-lg and overflow-hidden here */}
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="font-bold">{isMobile ? "Line" : "Line #"}</TableHead>
              <TableHead className="font-bold">Location</TableHead>
              <TableHead className="font-bold">Product</TableHead>
              {isMobile ? (
                <TableHead className="font-bold">WxH</TableHead>
              ) : (
                <>
                  <TableHead className="font-bold">Window Tag</TableHead>
                  <TableHead className="font-bold">Width</TableHead>
                  <TableHead className="font-bold">Height</TableHead>
                  <TableHead className="font-bold">Depth</TableHead>
                  <TableHead className="font-bold">Mount Type</TableHead>
                  <TableHead className="font-bold">Control Type</TableHead>
                  <TableHead className="font-bold">Wizard</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.windowItems.map((window) => (
              <TableRow key={window.id} className="hover:bg-gray-100">
                <TableCell className="font-medium">{window.lineNumber}</TableCell>
                <TableCell>{window.location}</TableCell>
                <TableCell>{window.product}</TableCell>
                {isMobile ? (
                  <TableCell>
                    {formatMeasurement(window.width)}x{formatMeasurement(window.height)}
                  </TableCell>
                ) : (
                  <>
                    <TableCell>{window.windowNumber}</TableCell>
                    <TableCell>{formatMeasurement(window.width)}"</TableCell>
                    <TableCell>{formatMeasurement(window.height)}"</TableCell>
                    <TableCell>{formatMeasurement(window.depth)}"</TableCell>
                    <TableCell className="capitalize">{window.mountType}</TableCell>
                    <TableCell>{window.controlType}</TableCell>
                    <TableCell>
                      {window.wizardMeasurements &&
                        ((window.wizardMeasurements.widths?.T ?? 0) > 0 ||
                        (window.wizardMeasurements.widths?.M ?? 0) > 0 ||
                        (window.wizardMeasurements.widths?.B ?? 0) > 0 ||
                        (window.wizardMeasurements.heights?.L ?? 0) > 0 ||
                        (window.wizardMeasurements.heights?.C ?? 0) > 0 ||
                        (window.wizardMeasurements.heights?.R ?? 0) > 0 ? (
                          <Badge className="bg-green-500">
                            <Ruler className="h-3 w-3 mr-1" />
                            {((window.wizardMeasurements.widths?.T ?? 0) > 0 ? 1 : 0) +
                             ((window.wizardMeasurements.widths?.M ?? 0) > 0 ? 1 : 0) +
                             ((window.wizardMeasurements.widths?.B ?? 0) > 0 ? 1 : 0) +
                             ((window.wizardMeasurements.heights?.L ?? 0) > 0 ? 1 : 0) +
                             ((window.wizardMeasurements.heights?.C ?? 0) > 0 ? 1 : 0) +
                             ((window.wizardMeasurements.heights?.R ?? 0) > 0 ? 1 : 0)}
                          </Badge>
                        ) : null)}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Global Signature Section - Moved below the table */}
      {formConfigState.config.sections.filter(section => section.id === 'projectSignatures' && section.isLineItemSection === false).map(section => (
        <GlobalFormSection
          key={section.id}
          section={section}
          globalFormData={state.globalFormData}
          updateGlobalFormData={updateGlobalFormData}
          validationErrors={validateGlobalData(state.globalFormData, allGlobalFields)}
        />
      ))}
    </div>
  )
}