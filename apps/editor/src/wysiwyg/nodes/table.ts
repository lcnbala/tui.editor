import { DOMOutputSpecArray, Node as ProsemirrorNode, Fragment, Slice } from 'prosemirror-model';
import { ReplaceStep } from 'prosemirror-transform';

import Node from '@/spec/node';
import { isInTableNode, findNodeBy } from '@/wysiwyg/helper/node';
import {
  createTableHead,
  createTableBody,
  createTableRows,
  getTableBodyCellPositions
} from '@/wysiwyg/helper/table';

import { EditorCommand } from '@t/spec';

export class Table extends Node {
  get name() {
    return 'table';
  }

  get schema() {
    return {
      content: 'tableHead{1} tableBody+',
      group: 'block',
      parseDOM: [{ tag: 'table' }],
      toDOM(): DOMOutputSpecArray {
        return ['table', 0];
      }
    };
  }

  private addTable(): EditorCommand {
    return (payload = {}) => (state, dispatch) => {
      const { columns = 1, rows = 1, data = [] } = payload;
      const { schema, tr, selection } = state;
      const { from, to, $from } = selection;
      const collapsed = from === to;

      if (collapsed && !isInTableNode(schema, $from)) {
        const thead = createTableHead(schema, columns, data);
        const tbody = createTableBody(schema, columns, rows, data);
        const table = schema.nodes.table.create(null, [thead, tbody]);

        dispatch!(tr.replaceSelectionWith(table).scrollIntoView());

        return true;
      }

      return false;
    };
  }

  private removeTable(): EditorCommand {
    return () => (state, dispatch) => {
      const { selection, schema, tr } = state;
      const { $anchor } = selection;
      const foundTable = findNodeBy(
        $anchor,
        ({ type }: ProsemirrorNode) => type === schema.nodes.table
      );

      if (foundTable) {
        const { depth } = foundTable;
        const from = $anchor.before(depth);
        const to = $anchor.after(depth);

        dispatch!(tr.delete(from, to).scrollIntoView());

        return true;
      }

      return false;
    };
  }

  private addRow(): EditorCommand {
    return () => (state, dispatch) => {
      const { selection, schema, tr } = state;
      const { $from } = selection;
      const { tableRow, tableBody } = schema.nodes;
      const foundRow = findNodeBy(
        $from,
        ({ type }: ProsemirrorNode, depth: number) =>
          type === tableRow && $from.node(depth - 1).type === tableBody
      );

      if (foundRow) {
        const { node, depth } = foundRow;
        const [row] = createTableRows(schema, node.childCount, 1, true);
        const from = $from.after(depth);

        dispatch!(tr.step(new ReplaceStep(from, from, new Slice(Fragment.from(row), 0, 0))));

        return true;
      }

      return false;
    };
  }

  private removeRow(): EditorCommand {
    return () => (state, dispatch) => {
      const { selection, schema, tr } = state;
      const { $from } = selection;
      const { tableBody, tableRow } = schema.nodes;
      const foundRow = findNodeBy(
        $from,
        ({ type }: ProsemirrorNode, depth: number) =>
          type === tableRow &&
          $from.node(depth - 1).type === tableBody &&
          $from.node(depth - 1).childCount > 1
      );

      if (foundRow) {
        const { depth } = foundRow;
        const from = $from.before(depth);
        const to = $from.after(depth);

        dispatch!(tr.step(new ReplaceStep(from, to, Slice.empty)));

        return true;
      }

      return false;
    };
  }

  private alignColumn(): EditorCommand {
    return (payload = {}) => (state, dispatch) => {
      const { align = 'center' } = payload;
      const { selection, schema, tr } = state;
      const { $from } = selection;
      const { tableBodyCell } = schema.nodes;
      const foundCell = findNodeBy($from, ({ type }: ProsemirrorNode) => type === tableBodyCell);

      if (foundCell) {
        const { depth } = foundCell;
        const tbodyCells = getTableBodyCellPositions($from, depth - 2);

        tbodyCells.forEach(tbodyCell => {
          const { pos } = $from.node(0).resolve(tbodyCell);

          tr.setNodeMarkup(pos, null!, { align });
        });

        dispatch!(tr);

        return true;
      }

      return false;
    };
  }

  commands() {
    return {
      addTable: this.addTable(),
      removeTable: this.removeTable(),
      addRow: this.addRow(),
      removeRow: this.removeRow(),
      alignColumn: this.alignColumn()
    };
  }
}