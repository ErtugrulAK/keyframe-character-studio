import { lazy } from 'react';

/** The library dialog opens on demand, so it loads then. */
export const LazyGraphicLibraryDialog = lazy(() => import('../Header/GraphicLibraryDialog').then((module) => ({ default: module.GraphicLibraryDialog })));
