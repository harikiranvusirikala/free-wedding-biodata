"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FIELD_CATALOG, type FieldKey } from "@/biodata/defaults";
import {
  CUSTOM_FIELD_TYPES,
  changeFieldType,
  locateField,
  locateMember,
  missingDefaults,
  moveMember,
  moveField,
  moveFieldToSection,
  moveSection,
  restoreSectionDefaults,
  sectionDefOf,
  setFieldMultiline,
  setFieldVisible,
  setMemberVisible,
  setSectionVisible,
} from "@/biodata/edits";
import type { FamilyMember, Field, FieldType, Section } from "@/biodata/types";
import { iconButton } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { Menu, MenuLabel, MenuSeparator, dangerMenuItem, menuItem } from "@/components/ui/Menu";
import { t } from "@/lib/i18n";
import { fieldLabel, memberLabel, sectionTitle, useLabelStyle } from "./labels";
import { fieldMenuId, memberMenuId, sectionMenuId, useManage } from "./ManageProvider";

// The ⋯ menus on field rows and section cards (BUILD_PLAN Step 2.2, VISION §6, mockup: editor). WAI-ARIA menus
// (ui/Menu): arrows move, Enter picks, Escape closes. "Change type" and "Move to section" open a list in the same
// panel (ArrowRight opens it, ArrowLeft or Back returns), which works the same with a finger, a mouse or keys.
// The menus read the latest profile as they open, so the rows they sit in never re-render for them.

/** Height of the sticky bars over the form (header; plus the section chips below 1024 px), for the menu's room above. */
const reserve = () => (typeof window !== "undefined" && window.innerWidth < 1024 ? 112 : 64);

const TYPE_ICONS: Record<FieldType, IconName> = {
  text: "type",
  textarea: "paragraph",
  date: "calendar",
  time: "clock",
  phone: "phone",
  email: "mail",
  select: "list",
  height: "ruler",
};

function Item({
  icon,
  children,
  onClick,
  disabled,
  danger,
  sub,
  title,
  checked,
  view,
  role = "menuitem",
}: {
  icon: IconName;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Opens a list in the panel (a chevron at the end; ArrowRight opens it too). */
  sub?: boolean;
  title?: string;
  checked?: boolean;
  /** The list this item opens, so going Back puts the focus on it again. */
  view?: string;
  role?: "menuitem" | "menuitemradio" | "menuitemcheckbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "menuitem" ? undefined : !!checked}
      aria-haspopup={sub ? "menu" : undefined}
      data-sub={sub ? "" : undefined}
      data-view={view}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={danger ? dangerMenuItem : menuItem}
    >
      <Icon name={icon} className={`size-[18px] ${danger ? "" : "text-ink-3"}`} />
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {sub && <Icon name="chevronRight" className="size-4 text-ink-3" />}
      {role !== "menuitem" && checked && <Icon name="check" className="size-4 text-brand-ink" />}
    </button>
  );
}

/**
 * The items of a menu with lists that open in place: `views` maps a view name to its items. Changing view
 * focuses the first item of the new one (or, going back, the item that opened the list).
 */
function Views<V extends string>({ view, setView, children }: { view: V; setView: (view: V | "main") => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const items = [...(root.current?.querySelectorAll<HTMLElement>("[role^='menuitem']:not([disabled])") ?? [])];
    const back = view === "main" && opener.current ? items.find((item) => item.dataset.view === opener.current) : undefined;
    const checked = root.current?.querySelector<HTMLElement>("[aria-checked='true']");
    (back ?? (view === "main" ? items[0] : (checked ?? items[1] ?? items[0])))?.focus();
  }, [view]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.key === "ArrowRight" && target.dataset.sub !== undefined) {
      event.preventDefault();
      target.click();
    } else if (event.key === "ArrowLeft" && view !== "main") {
      event.preventDefault();
      setView("main");
    }
  }

  return (
    <div
      ref={root}
      role="none"
      onKeyDown={onKeyDown}
      onClickCapture={(event) => {
        const opened = (event.target as HTMLElement).closest<HTMLElement>("[data-view]")?.dataset.view;
        if (opened) opener.current = opened;
      }}
    >
      {children}
    </div>
  );
}

function BackItem({ onClick }: { onClick: () => void }) {
  return (
    <Item icon="chevronLeft" onClick={onClick}>
      {t("manage.back")}
    </Item>
  );
}

/** The types a field can change to: its own catalogue type (a list, a height) first, then the custom types. */
function typesFor(field: Field): FieldType[] {
  const own = field.key && Object.hasOwn(FIELD_CATALOG, field.key) ? FIELD_CATALOG[field.key as FieldKey].type : undefined;
  const custom: FieldType[] = [...CUSTOM_FIELD_TYPES];
  return own && !custom.includes(own) ? [own, ...custom] : custom;
}

const menuButton = `${iconButton} text-ink-3`;

export function FieldMenu({ field, readOnly }: { field: Field; readOnly: boolean }) {
  const label = fieldLabel(field, useLabelStyle());
  return (
    <Menu
      id={fieldMenuId(field.id)}
      label={t("manage.field.menu", { label })}
      buttonLabel={t("manage.field.menu", { label })}
      buttonTitle={t("manage.field.menu", { label })}
      button={<Icon name="more" className="size-[18px]" />}
      buttonClassName={menuButton}
      disabled={readOnly}
      menuClassName="w-64"
      autoPlace={{ reserve: reserve() }}
    >
      {(close) => <FieldMenuItems field={field} close={close} />}
    </Menu>
  );
}

function FieldMenuItems({ field, close }: { field: Field; close: () => void }) {
  const manage = useManage();
  const [view, setView] = useState<"main" | "type" | "move">("main");
  const profile = manage.current();
  const labelStyle = useLabelStyle();
  const at = locateField(profile, field.id);
  const label = fieldLabel(field, labelStyle);
  const id = field.id;
  const targets = profile.sections.filter((s) => s.kind === "fields" && s.id !== at?.section.id);
  const run = (change: Parameters<typeof manage.edit>[0]) => {
    close();
    manage.edit(change);
  };

  if (view === "type") {
    return (
      <Views view={view} setView={setView}>
        <MenuLabel>{t("manage.type.label", { label })}</MenuLabel>
        <BackItem onClick={() => setView("main")} />
        <MenuSeparator />
        {typesFor(field).map((type) => (
          <Item key={type} role="menuitemradio" checked={field.type === type} icon={TYPE_ICONS[type]} onClick={() => run((p) => changeFieldType(p, id, type))}>
            {t(`manage.type.${type}`)}
          </Item>
        ))}
      </Views>
    );
  }

  if (view === "move") {
    return (
      <Views view={view} setView={setView}>
        <MenuLabel>{t("manage.moveTo.label", { label })}</MenuLabel>
        <BackItem onClick={() => setView("main")} />
        <MenuSeparator />
        <div className="max-h-72 overflow-y-auto overscroll-contain" role="none">
          {targets.map((section) => (
            <Item
              key={section.id}
              icon="arrowRight"
              onClick={() => {
                close();
                manage.edit((p) => moveFieldToSection(p, id, section.id));
                manage.notify(t("manage.moved", { label, section: sectionTitle(section, labelStyle) }));
                manage.focusSoon(`${fieldMenuId(id)}-button`);
              }}
            >
              {sectionTitle(section, labelStyle)}
            </Item>
          ))}
        </div>
      </Views>
    );
  }

  const index = at?.index ?? 0;
  const count = at?.section.fields.length ?? 0;
  return (
    <Views view={view} setView={setView}>
      <Item
        icon="edit"
        onClick={() => {
          close();
          manage.open({ kind: "renameField", fieldId: id });
        }}
      >
        {t("manage.rename")}
      </Item>
      <Item icon="type" sub view="type" onClick={() => setView("type")}>
        {t("manage.changeType")}
      </Item>
      {field.type === "text" && (
        <Item icon="lines" role="menuitemcheckbox" checked={!!field.multiline} onClick={() => run((p) => setFieldMultiline(p, id, !field.multiline))}>
          {t("manage.multiline")}
        </Item>
      )}
      <MenuSeparator />
      <Item icon="arrowUp" disabled={index === 0} onClick={() => run((p) => moveField(p, id, -1))}>
        {t("manage.moveUp")}
      </Item>
      <Item icon="arrowDown" disabled={index >= count - 1} onClick={() => run((p) => moveField(p, id, 1))}>
        {t("manage.moveDown")}
      </Item>
      <Item icon="move" sub view="move" disabled={targets.length === 0} onClick={() => setView("move")}>
        {t("manage.moveTo")}
      </Item>
      <MenuSeparator />
      <Item icon={field.visible ? "eyeOff" : "eye"} onClick={() => run((p) => setFieldVisible(p, id, !field.visible))}>
        {t(field.visible ? "manage.hide" : "manage.show")}
      </Item>
      <Item
        icon="trash"
        danger
        onClick={() => {
          close();
          manage.open({ kind: "removeField", fieldId: id });
        }}
      >
        {t("manage.remove")}
      </Item>
    </Views>
  );
}

/** A family member's ⋯ menu (Step 2.3, D28): change the relation, move, hide or remove the row. */
export function MemberMenu({ member, readOnly }: { member: FamilyMember; readOnly: boolean }) {
  const label = memberLabel(member);
  return (
    <Menu
      id={memberMenuId(member.id)}
      label={t("member.menu", { label })}
      buttonLabel={t("member.menu", { label })}
      buttonTitle={t("member.menu", { label })}
      button={<Icon name="more" className="size-[18px]" />}
      buttonClassName={menuButton}
      disabled={readOnly}
      menuClassName="w-64"
      autoPlace={{ reserve: reserve() }}
    >
      {(close) => <MemberMenuItems member={member} close={close} />}
    </Menu>
  );
}

function MemberMenuItems({ member, close }: { member: FamilyMember; close: () => void }) {
  const manage = useManage();
  const at = locateMember(manage.current(), member.id);
  const index = at?.index ?? 0;
  const count = at?.section.members.length ?? 0;
  const id = member.id;

  function move(step: -1 | 1) {
    close();
    manage.edit((p) => moveMember(p, id, step));
    manage.focusSoon(`${memberMenuId(id)}-button`);
  }

  return (
    <>
      <Item
        icon="edit"
        onClick={() => {
          close();
          manage.open({ kind: "editRelation", memberId: id });
        }}
      >
        {t("member.editRelation")}
      </Item>
      <MenuSeparator />
      <Item icon="arrowUp" disabled={index === 0} onClick={() => move(-1)}>
        {t("manage.moveUp")}
      </Item>
      <Item icon="arrowDown" disabled={index >= count - 1} onClick={() => move(1)}>
        {t("manage.moveDown")}
      </Item>
      <MenuSeparator />
      <Item
        icon={member.visible ? "eyeOff" : "eye"}
        onClick={() => {
          close();
          manage.edit((p) => setMemberVisible(p, id, !member.visible));
        }}
      >
        {t(member.visible ? "manage.hide" : "manage.show")}
      </Item>
      <Item
        icon="trash"
        danger
        onClick={() => {
          close();
          manage.open({ kind: "removeMember", memberId: id });
        }}
      >
        {t("manage.remove")}
      </Item>
    </>
  );
}

export function SectionMenu({ section, readOnly }: { section: Section; readOnly: boolean }) {
  const title = sectionTitle(section, useLabelStyle());
  return (
    <Menu
      id={sectionMenuId(section.id)}
      label={t("manage.section.menu", { title })}
      buttonLabel={t("manage.section.menu", { title })}
      buttonTitle={t("manage.section.menu", { title })}
      button={<Icon name="more" className="size-[18px]" />}
      buttonClassName={menuButton}
      disabled={readOnly}
      menuClassName="w-64"
      autoPlace={{ reserve: reserve() }}
    >
      {(close) => <SectionMenuItems section={section} close={close} />}
    </Menu>
  );
}

function SectionMenuItems({ section, close }: { section: Section; close: () => void }) {
  const manage = useManage();
  const labelStyle = useLabelStyle();
  const profile = manage.current();
  const index = profile.sections.findIndex((s) => s.id === section.id);
  const id = section.id;
  const def = sectionDefOf(section, profile.options.formLayout);
  const restorable = def !== undefined && (def.kind === "fields" ? def.fields.length : def.members.length) > 0;
  const missing = restorable ? missingDefaults(profile, section).length : 0;

  function move(step: -1 | 1) {
    close();
    manage.edit((p) => moveSection(p, id, step));
    manage.focusSoon(`${sectionMenuId(id)}-button`);
  }

  return (
    <>
      <Item
        icon="edit"
        onClick={() => {
          close();
          manage.open({ kind: "renameSection", sectionId: id });
        }}
      >
        {t("manage.rename")}
      </Item>
      <MenuSeparator />
      <Item icon="arrowUp" disabled={index <= 0} onClick={() => move(-1)}>
        {t("manage.moveUp")}
      </Item>
      <Item icon="arrowDown" disabled={index < 0 || index >= profile.sections.length - 1} onClick={() => move(1)}>
        {t("manage.moveDown")}
      </Item>
      <MenuSeparator />
      <Item
        icon={section.visible ? "eyeOff" : "eye"}
        onClick={() => {
          close();
          manage.edit((p) => setSectionVisible(p, id, !section.visible));
        }}
      >
        {t(section.visible ? "manage.section.hide" : "manage.section.show")}
      </Item>
      {restorable && (
        <Item
          icon="refresh"
          disabled={missing === 0}
          title={missing === 0 ? t("manage.section.restoreNone") : undefined}
          onClick={() => {
            close();
            manage.edit((p) => restoreSectionDefaults(p, id));
            const name = sectionTitle(section, labelStyle);
            manage.notify(missing === 1 ? t("manage.restored.one", { section: name }) : t("manage.restored.many", { count: missing, section: name }));
          }}
        >
          {t("manage.section.restore")}
        </Item>
      )}
      <Item
        icon="trash"
        danger
        onClick={() => {
          close();
          manage.open({ kind: "removeSection", sectionId: id });
        }}
      >
        {t("manage.section.remove")}
      </Item>
    </>
  );
}
