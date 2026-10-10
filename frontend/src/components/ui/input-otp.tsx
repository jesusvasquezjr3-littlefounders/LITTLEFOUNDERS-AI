"use client";

import * as React from "react";
import { useFlowGroup } from "@/lib/cojeev-motion/use-flow";
import { useMorph } from "@/lib/cojeev-motion/use-morph";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp";
export const inputOTPVariants = cva("v-otp flex gap-[var(--s-2)]");
export type InputOTPProps = React.ComponentProps<typeof OTPInput>;
export function InputOTP({
  containerClassName,
  className,
  pattern = REGEXP_ONLY_DIGITS,
  ...props
}: InputOTPProps) {
  return (
    <OTPInput
      data-slot="input-otp"
      data-part="root"
      data-otp=""
      containerClassName={cn(inputOTPVariants(), containerClassName)}
      className={className}
      pattern={pattern}
      {...props}
    />
  );
}
export type InputOTPGroupProps = React.ComponentProps<"div">;
export function InputOTPGroup({
  className,
  ref,
  ...props
}: InputOTPGroupProps) {
  const morphRef = useMorph<HTMLDivElement>("inputs", ref);
  const flowRef = useFlowGroup<HTMLDivElement>(morphRef, {
    kind: "fill",
    itemSelector: '[data-slot="input-otp-slot"]',
    activeSelector: '[data-state="active"]',
  });
  return (
    <div
      ref={flowRef}
      data-slot="input-otp-group"
      data-flow-fields="auto"
      className={cn("v-otp flex gap-[var(--s-2)]", className)}
      {...props}
    />
  );
}
export type InputOTPSlotProps = React.ComponentProps<"div"> & { index: number };
export function InputOTPSlot({
  className,
  index,
  ...props
}: InputOTPSlotProps) {
  const context = React.useContext(OTPInputContext);
  const slot = context.slots[index];
  return (
    <div
      data-slot="input-otp-slot"
      data-part="item"
      data-active={slot?.isActive || undefined}
      data-state={slot?.isActive ? "active" : "inactive"}
      className={cn("grid place-items-center relative", className)}
      {...props}
    >
      {slot?.char}
      {slot?.hasFakeCaret && (
        <span aria-hidden="true" className="absolute h-5 w-px bg-current" />
      )}
    </div>
  );
}
export type InputOTPSeparatorProps = React.ComponentProps<"div">;
export function InputOTPSeparator({
  children,
  ...props
}: InputOTPSeparatorProps) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      {children ?? "−"}
    </div>
  );
}
