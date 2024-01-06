export type Flags = number

export const NoFlags = 0b0000000

// 和结构相关
export const Placement = 0b0000001
// 和属性相关
export const Update = 0b0000010

export const ChildDeletion = 0b0000100

export const PassiveEffect = 0b0001000

export const Ref = 0b0010000

export const MutationMask = Placement | Update | ChildDeletion | Ref
export const LayoutMask =  Ref

export const PassiveMask = PassiveEffect | ChildDeletion
