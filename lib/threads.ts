/** Shared by the reader's thread cards and the Vault's Threads mode (Phase 4). */
import type { ConnectionType, ThreadEnd } from './types';

export const TYPE_LABEL: Record<ConnectionType, string> = {
  quotation: 'Quotation',
  allusion: 'Allusion',
  echo: 'Verbal echo',
  typology: 'Typology',
  parallel: 'Parallel',
  fulfilment: 'Fulfilment',
  contrast: 'Contrast',
};

/** The types in the order the filter lists them. */
export const TYPE_ORDER = Object.keys(TYPE_LABEL) as ConnectionType[];

/** Open one end of a connection in the reader, with the way back along it (`?thread=`). */
export const threadHref = (id: string, end: Pick<ThreadEnd, 'sectionId' | 'anchor'>) =>
  `/read/${end.sectionId}/?thread=${id}#${end.anchor}`;
