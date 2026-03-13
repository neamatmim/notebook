import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { isFunction } from "es-toolkit/compat";
import { createContext, useContext, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export function RowSelector({
  children,
}: {
  children: (props: {
    rowSelection: RowSelectionState;
    onRowSelectionChange: Dispatch<SetStateAction<RowSelectionState>>;
    selectedRows: string[];
  }) => React.ReactNode;
}) {
  const [rowSelection, onRowSelectionChange] = useState<RowSelectionState>({});
  // console.log("🚀 ~ RowSelector ~ rowSelection:", rowSelection);
  const selectedRows = Object.keys(rowSelection).filter(
    (key) => rowSelection[key]
  );
  return children({
    rowSelection,
    onRowSelectionChange,
    selectedRows,
  });
}

interface RowSelectorState {
  rowSelection: RowSelectionState;
}

interface RowSelectorActions {
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  reset: () => void;
}

type RowSelectorStore = RowSelectorState & RowSelectorActions;

const initRowSelectorStore = (): RowSelectorState => ({
  rowSelection: {},
});

const defaultInitState: RowSelectorState = {
  rowSelection: {},
};

const createRowSelectorStore = (
  initState: RowSelectorState = defaultInitState
) =>
  createStore<RowSelectorStore>()((set, _, store) => ({
    ...initState,
    onRowSelectionChange: (updaterFn) => {
      set((state) => ({
        rowSelection: isFunction(updaterFn)
          ? updaterFn(state.rowSelection)
          : updaterFn,
      }));
    },
    reset: () => {
      set(store.getInitialState());
    },
  }));

type RowSelectorStoreApi = ReturnType<typeof createRowSelectorStore>;

export const RowSelectorStoreContext = createContext<
  RowSelectorStoreApi | undefined
>(undefined);

interface RowSelectorStoreProviderProps {
  children: React.ReactNode;
}

export const DataTableRowSelectorStoreProvider = ({
  children,
}: RowSelectorStoreProviderProps) => {
  const storeRef = useRef<RowSelectorStoreApi | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createRowSelectorStore(initRowSelectorStore());
  }

  return (
    <RowSelectorStoreContext.Provider value={storeRef.current}>
      {children}
    </RowSelectorStoreContext.Provider>
  );
};

export const useRowSelectorStore = <T,>(
  selector: (store: RowSelectorStore) => T
): T => {
  const rowSelectorStoreContext = useContext(RowSelectorStoreContext);

  if (!rowSelectorStoreContext) {
    throw new Error(
      "useRowSelectorStore must be used within RowSelectorStoreProvider"
    );
  }

  return useStore(rowSelectorStoreContext, selector);
};

export function DataTableRowSelectorStoreConsumer({
  children,
}: {
  children: (props: {
    rowSelection: RowSelectionState;
    onRowSelectionChange: OnChangeFn<RowSelectionState>;
    selectedRows: string[];
    reset: () => void;
  }) => React.ReactNode;
}) {
  const rowSelection = useRowSelectorStore((state) => state.rowSelection);
  const onRowSelectionChange = useRowSelectorStore(
    (state) => state.onRowSelectionChange
  );
  const reset = useRowSelectorStore((state) => state.reset);
  const selectedRows = Object.keys(rowSelection).filter(
    (key) => rowSelection[key]
  );
  console.log("selectedRows", selectedRows, rowSelection);
  return children({
    rowSelection,
    onRowSelectionChange,
    selectedRows,
    reset,
  });
}
