/**
 * The grid's icon set, aliased in one place so swapping icon libraries is a
 * single-file change.
 *
 * `@tabler/icons-react` ships one ES module per icon and declares
 * `sideEffects: false`, so only the icons re-exported here reach the bundle.
 */
export {
  IconArrowDown as ArrowDownIcon,
  IconArrowUp as ArrowUpIcon,
  IconChevronLeft as ChevronLeftIcon,
  IconChevronRight as ChevronRightIcon,
  IconColumns3 as ColumnsIcon,
  IconDotsVertical as DotsVerticalIcon,
  IconEyeOff as EyeOffIcon,
  IconFilter as FilterIcon,
  IconArrowBarToLeft as PinLeftIcon,
  IconArrowBarToRight as PinRightIcon,
  IconMenu2 as BurgerIcon,
  IconPinnedOff as PinOffIcon,
  IconSearch as SearchIcon,
  IconX as CloseIcon,
} from "@tabler/icons-react";
