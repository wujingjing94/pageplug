import React, { useState } from "react";

import styled from "styled-components";
import { Classes, MenuItem } from "@blueprintjs/core";
import { noop } from "lodash";

import { CommonComponentProps } from "components/ads/common";
import Icon, { IconSize } from "components/ads/Icon";
import AnalyticsUtil from "utils/AnalyticsUtil";

export enum MenuTypes {
  MENU = "menu",
  PARENT = "parent",
  RECONFIRM = "re-confirm",
}

export interface MenuItemData {
  text: string;
  label?: string;
  onClick?: typeof noop;
  children?: MenuItemData[];
  type: MenuTypes;
  isVisible: boolean;
  confirmText?: string;
  isOpensNewWindow?: boolean | undefined;
  style?: React.CSSProperties;
}

const StyledMenuItem = styled(MenuItem)`
  width: 240px;
  background: ${(props) =>
    props.theme.colors.navigationMenu.backgroundInactive};
  color: ${(props) => props.theme.colors.navigationMenu.contentInactive};
  border-radius: 0;
  height: ${(props) => props.theme.navbarMenuHeight};

  &&&:hover {
    color: ${(props) => props.theme.colors.navigationMenu.contentActive};
    background: ${(props) =>
      props.theme.colors.navigationMenu.backgroundActive};
    background-color: ${(props) =>
      props.theme.colors.navigationMenu.backgroundActive};
  }

  > .${Classes.MENU_ITEM_LABEL} {
    color: ${(props) => props.theme.colors.navigationMenu.label};
  }
`;

type NavigationMenuItemProps = CommonComponentProps & {
  menuItemData: MenuItemData;
  setIsPopoverOpen: typeof noop;
  children?: React.ReactNode;
};

export function NavigationMenuItem({
  children,
  menuItemData,
  setIsPopoverOpen,
}: NavigationMenuItemProps) {
  const {
    confirmText,
    isOpensNewWindow,
    isVisible,
    label,
    onClick,
    style,
    text,
  } = menuItemData;

  const [confirm, setConfirm] = useState({
    isConfirm: false,
    text: text,
  });

  if (!isVisible) return null;

  const labelElement = isOpensNewWindow && (
    <Icon name="open" size={IconSize.LARGE} />
  );

  const handleClick = (e: React.SyntheticEvent) => {
    setIsPopoverOpen(false);
    if (onClick) onClick(e);
    AnalyticsUtil.logEvent("APP_MENU_OPTION_CLICK", {
      option: text,
    });
  };

  const handleReconfirmClick = (e: React.SyntheticEvent) => {
    if (!confirm.isConfirm && confirmText) {
      setConfirm({
        isConfirm: true,
        text: confirmText,
      });
      e.preventDefault();
      e.stopPropagation();
    } else if (onClick) {
      setIsPopoverOpen(false);
      onClick(e);
      AnalyticsUtil.logEvent("APP_MENU_OPTION_CLICK", {
        option: text,
      });
      setConfirm({
        isConfirm: false,
        text: text,
      });
    }
  };

  switch (menuItemData.type) {
    case MenuTypes.MENU:
      return (
        <StyledMenuItem
          label={label}
          labelElement={labelElement}
          onClick={handleClick}
          style={style}
          text={text}
        />
      );
    case MenuTypes.PARENT:
      return (
        <StyledMenuItem label={label} style={style} text={confirm.text}>
          {children}
        </StyledMenuItem>
      );
    case MenuTypes.RECONFIRM:
      return (
        <StyledMenuItem
          label={label}
          onClick={handleReconfirmClick}
          style={style}
          text={confirm.text}
        />
      );
  }

  return null;
}
