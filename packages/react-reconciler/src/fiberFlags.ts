export type Flags = number

export const NoFlags = 0b0000000

// 和结构相关
export const Placement = 0b0000001
// 和属性相关
export const Update = 0b0000010

export const ChildDeletion = 0b0000100

export const MutationMask = Placement | Update | ChildDeletion
