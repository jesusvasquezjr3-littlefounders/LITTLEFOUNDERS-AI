import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import i18n from '@/i18n';
import { AddKidCard } from '../AddKidCard';
import { ManageKidPanel } from '../ManageKidPanel';

/*
 * tutor-review-sweep-92 (i18n-quality): pt-BR's Add-a-child / Manage-kid copy
 * hardcoded masculine-only pronouns and nouns for the child ("um filho",
 * "ele", "dele", the "-lo" clitic) even though no gender is ever collected on
 * a kid account anywhere in the product (database/, backend/src/routes/
 * family.ts). Worse, it was internally inconsistent: this SAME pt-BR locale's
 * tutor.json already spoke of "seu filho ou filha" for the identical concept.
 *
 * Unlike the OTHER files in this directory, this one deliberately does NOT
 * mock react-i18next — the whole point is to render the REAL translation
 * strings and assert on their actual text, the way a parent would read them.
 *
 * The fix anchors the flow on "a criança" (Portuguese's epicene noun for
 * "child" — grammatically feminine regardless of the referent's sex, exactly
 * like "a pessoa" or "a vítima" — already used elsewhere in this very file:
 * family.emptyTitle/emptyBody) instead of the sex-marked "filho" ("son").
 * Concording pronouns ("ela", "chamar a criança") follow from that anchor and
 * therefore no longer assume — in either direction — a gender nobody
 * collected. Where a string has no local "criança" antecedent (the
 * ManageKidPanel controls, which live on a specific kid's own row/panel, not
 * inside the "add a child" form), the fix drops the pronoun instead of
 * guessing, matching the "Remover esta conta" precedent already in the same
 * object.
 *
 * es-MX carried the identical root defect in family.addKid ("un hijo", the
 * "lo" clitic) — confirmed by es-MX's OWN tutor.json already using "hijo o
 * hija" for the same concept — so it is fixed here too and covered below.
 * en-US was already gender-neutral ("child", "they/their") and is untouched.
 */

vi.mock('@/lib/api', () => ({ api: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: vi.fn().mockResolvedValue('fake-token') }) }));

const KID = { userId: 'kid-1', displayName: 'Ana', username: 'ana_2016' };

afterAll(async () => {
  // This module reaches into the app's real, shared i18n singleton — leave it
  // the way every other test file in this repo expects to find it.
  await i18n.changeLanguage('en-US');
});

describe('pt-BR: family add-child / manage-kid copy no longer assumes a gender', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
  });

  it('opens the add-a-child form with gender-neutral copy naming "a criança"', () => {
    render(<AddKidCard onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar uma criança/ }));

    // The old masculine-only anchor noun and its dependent pronouns must be gone.
    expect(document.body.textContent).not.toMatch(/\bum filho\b/);
    expect(document.body.textContent).not.toMatch(/\bdele\b/);
    expect(document.body.textContent).not.toMatch(/chamá-lo/);

    // The corrected, gender-neutral copy is what actually renders.
    expect(screen.getByRole('heading', { name: 'Adicionar uma criança' })).toBeInTheDocument();
    expect(
      screen.getByText('Você cria a conta, então a criança não precisa de e-mail. Daqui você vê tudo o que ela faz.'),
    ).toBeInTheDocument();
    expect(screen.getByText('O primeiro nome')).toBeInTheDocument();
    expect(screen.getByText('Só o primeiro nome. É assim que os mentores vão chamar a criança.')).toBeInTheDocument();
  });

  it('shows the manage-kid menu without a gendered "dele" on any control', () => {
    render(<ManageKidPanel kid={KID} onRenamed={vi.fn()} onRemoved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar/ }));

    expect(screen.getByRole('button', { name: 'Mudar o nome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mudar a senha' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bdele\b/);
  });

  it('confirms a passphrase rotation without saying "diga a ele"', async () => {
    render(<ManageKidPanel kid={KID} onRenamed={vi.fn()} onRemoved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mudar a senha' }));
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'frase-nova-bem-longa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar a nova senha' }));

    await waitFor(() => expect(screen.getByText('Pronto. Agora é só compartilhar a nova senha.')).toBeInTheDocument());
    expect(screen.queryByText(/Diga a ele/)).toBeNull();
  });

  it('names what removal destroys without an "ele fez" pronoun', () => {
    render(<ManageKidPanel kid={KID} onRenamed={vi.fn()} onRemoved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover esta conta' }));

    expect(
      screen.getByText('Isto apaga Ana e tudo o que essa conta fez: o progresso, a sequência e as conversas. Não dá para desfazer.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bele fez\b/);
  });
});

describe('es-MX: the same root defect, found during the pt-BR sweep, is also fixed', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es-MX');
  });

  it('opens the add-a-child form naming "un hijo o una hija", not just "un hijo"', () => {
    render(<AddKidCard onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Agregar a un hijo o una hija/ }));

    expect(document.body.textContent).not.toMatch(/\blo van a llamar\b/);
    expect(
      screen.getByText('Tú creas la cuenta, así que tu hijo o hija no necesita correo electrónico. Desde aquí puedes ver todo lo que hace.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Solo el nombre. Así es como los mentores van a llamar a tu hijo o hija.'),
    ).toBeInTheDocument();
  });
});
