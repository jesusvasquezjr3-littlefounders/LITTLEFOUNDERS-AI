import * as React from "react"
import {cva,type VariantProps} from "class-variance-authority"
import {cn} from "@/lib/utils"
import {AppIcon} from "@/components/AppIcon"
import type {IconName} from "@/icons/rest"
import {useMorph} from "@/lib/cojeev-motion/use-morph"
import {useFlowPress} from "@/lib/cojeev-motion/flow-press"

/*
 * The library's components ask for an icon by a name of the library's own set ("x", "chevron-right", "check").
 * This platform draws every icon itself (D-054, docs/design/ICON-SYSTEM.md), so the library's icon set and its
 * drawing engine are not here: `Icon` answers those names with our own icons, and draws nothing for a name we
 * have no icon for. A component that needs another icon is given one of ours as its child.
 */
const OWN:Record<string,{name:IconName;turn?:string}>={
  "x":{name:"close"},"close":{name:"close"},"check":{name:"check"},
  "chevron-left":{name:"chevron"},"arrow-left":{name:"chevron"},
  "chevron-right":{name:"chevron",turn:"rotate-180"},"arrow-right":{name:"chevron",turn:"rotate-180"},
  "chevron-up":{name:"chevron",turn:"rotate-90"},"arrow-up":{name:"chevron",turn:"rotate-90"},
  "chevron-down":{name:"chevron",turn:"-rotate-90"},"arrow-down":{name:"chevron",turn:"-rotate-90"},
}
const SIZES={sm:16,default:20,lg:24} as const

export type IconProps={
  name:string;
  size?:"default"|"sm"|"lg";
  className?:string;
}
export function Icon({name,size="default",className}:IconProps){
  const own=OWN[name]
  return own?<AppIcon name={own.name} size={SIZES[size]} className={cn(own.turn,className)}/>:null
}

const DiskVariants=cva("v-disk [display:inline-grid] [place-items:center] [width:var(--disk-md)] [height:var(--disk-md)] [border-radius:50%] [background:var(--disk-bg,var(--v-beige))] [color:var(--v-text)] [flex:none]",{variants:{variant:{"default":"","pink":"-pink [--disk-bg:var(--v-pink)] [color:var(--v-on-accent)]","yellow":"-yellow [--disk-bg:var(--v-yellow)] [color:var(--v-on-accent)]","olive":"-olive [--disk-bg:var(--v-olive)] [color:var(--v-on-accent)]","blue":"-blue [--disk-bg:var(--v-blue)] [color:var(--v-on-accent)]","ink":"-ink [--disk-bg:var(--v-ink)] [color:var(--v-on-ink)]","cream":"-cream [--disk-bg:var(--v-canvas)]","beige":"-beige [--disk-bg:var(--v-beige)]"},size:{"default":"","sm":"-sm [width:var(--disk-sm)] [height:var(--disk-sm)]","lg":"-lg [width:var(--disk-lg)] [height:var(--disk-lg)]"}},defaultVariants:{variant:"default",size:"default"}})
export type DiskProps=React.ComponentProps<"span"> & VariantProps<typeof DiskVariants>
export function Disk({className,variant,size,ref,...props}:DiskProps){const morphRef=useMorph<HTMLSpanElement>("icons",ref);return <span ref={morphRef} data-slot="disk"  className={cn(DiskVariants({variant,size}),className)} {...props}/>}
const IconButtonVariants=cva("v-ibtn [display:inline-grid] [place-items:center] [width:var(--ctl-md)] [height:var(--ctl-md)] [border-radius:50%] [color:var(--v-text)] [background:transparent] [box-shadow:inset_0_0_0_1px_var(--v-border)] [transition:background_var(--t-micro),box-shadow_var(--t-micro)]",{variants:{variant:{"default":"","dashed":"-dashed [box-shadow:none] [border:1px_dashed_var(--v-text-2)] [border-color:var(--v-edge)]","ink":"-ink [background:var(--v-ink)] [color:var(--v-on-ink)] [box-shadow:none]","pink":"-pink [background:var(--v-pink)] [box-shadow:none] [color:var(--v-on-accent)]","beige":"-beige [background:var(--v-beige)] [box-shadow:inset_0_0_0_1px_var(--v-edge)] [color:var(--v-on-accent)]","cream":"-cream [background:var(--v-canvas)] [box-shadow:inset_0_0_0_1px_var(--v-edge)]"},size:{"default":"","sm":"-sm [width:var(--ctl-sm)] [height:var(--ctl-sm)]","lg":"-lg [width:var(--ctl-lg)] [height:var(--ctl-lg)]","xl":"-xl [width:var(--dock-action)] [height:var(--dock-action)]"}},defaultVariants:{variant:"default",size:"default"}})
export type IconButtonProps=React.ComponentProps<"button"> & VariantProps<typeof IconButtonVariants>
export function IconButton({className,variant,size,ref,...props}:IconButtonProps){const morphRef=useMorph<HTMLButtonElement>("icons",ref);const ownedRef=useFlowPress(morphRef);return <button ref={ownedRef} data-slot="icon-button" type="button" className={cn(IconButtonVariants({variant,size}),className)} {...props}/>}
