import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  it('place le focus dans le menu et permet de le parcourir au clavier', () => {
    render(
      <ContextMenu
        ariaLabel="Actions du morceau"
        trigger={<span>Actions</span>}
        items={[
          { id: 'edit', label: 'Modifier', icon: 'edit', onSelect: () => undefined },
          { id: 'copy', label: 'Dupliquer', icon: 'copy', onSelect: () => undefined },
          { id: 'delete', label: 'Supprimer', icon: 'trash', onSelect: () => undefined },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Actions du morceau' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'Modifier' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Dupliquer' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
