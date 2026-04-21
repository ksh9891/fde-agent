"use client";

import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface FormFieldDef {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "select" | "textarea" | "date";
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

interface FormBuilderProps {
  fields: FormFieldDef[];
  onSubmit: (data: Record<string, unknown>) => void;
  defaultValues?: Record<string, unknown>;
  submitLabel?: string;
  isLoading?: boolean;
}

export function FormBuilder({
  fields,
  onSubmit,
  defaultValues = {},
  submitLabel = "저장",
  isLoading = false,
}: FormBuilderProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: defaultValues as Record<string, string>,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && (
              <span className="text-destructive ml-0.5">*</span>
            )}
          </Label>

          {field.type === "select" ? (
            <select
              id={field.name}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              {...register(field.name, {
                required: field.required ? `${field.label}을(를) 선택해주세요.` : false,
              })}
            >
              <option value="">
                {field.placeholder ?? `${field.label} 선택`}
              </option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              id={field.name}
              rows={4}
              placeholder={field.placeholder}
              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 resize-none"
              {...register(field.name, {
                required: field.required ? `${field.label}을(를) 입력해주세요.` : false,
              })}
            />
          ) : (
            <Input
              id={field.name}
              type={field.type}
              placeholder={field.placeholder}
              {...register(field.name, {
                required: field.required ? `${field.label}을(를) 입력해주세요.` : false,
              })}
            />
          )}

          {errors[field.name] && (
            <p className="text-xs text-destructive">
              {errors[field.name]?.message as string}
            </p>
          )}
        </div>
      ))}

      <div className="pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "처리 중..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
