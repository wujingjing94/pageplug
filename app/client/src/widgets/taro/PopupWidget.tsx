import React, { ReactNode } from "react";
import { connect } from "react-redux";
import { ReduxActionTypes } from "constants/ReduxActionConstants";
import BaseWidget, { WidgetProps, WidgetState } from "../BaseWidget";
import { EventType } from "constants/AppsmithActionConstants/ActionConstants";
import WidgetFactory from "utils/WidgetFactory";
import { ValidationTypes } from "constants/WidgetValidation";
import ModalComponent from "components/designSystems/taro/PopoverComponent";
import {
  WidgetTypes,
  RenderMode,
  MAIN_CONTAINER_WIDGET_ID,
} from "constants/WidgetConstants";
import { generateClassName } from "utils/generators";
import withMeta, { WithMeta } from "../MetaHOC";
import { AppState } from "reducers";
import { getWidget } from "sagas/selectors";

export class MPopupWidget extends BaseWidget<MPopupWidgetProps, WidgetState> {
  static getPropertyPaneConfig() {
    return [
      {
        sectionName: "属性",
        children: [
          {
            propertyName: "height",
            label: "弹窗高度（不带单位的数字）",
            controlType: "INPUT_TEXT",
            isBindProperty: true,
            isTriggerProperty: false,
            validation: {
              type: ValidationTypes.NUMBER,
              params: { min: 200, max: 800 },
            },
          },
          {
            propertyName: "canOutsideClickClose",
            label: "点击背景关闭",
            controlType: "SWITCH",
            isBindProperty: false,
            isTriggerProperty: false,
          },
          {
            propertyName: "rounded",
            label: "圆角风格",
            controlType: "SWITCH",
            isBindProperty: false,
            isTriggerProperty: false,
          },
        ],
      },
      {
        sectionName: "动作",
        children: [
          {
            helpText: "弹窗关闭后触发",
            propertyName: "onClose",
            label: "onClose",
            controlType: "ACTION_SELECTOR",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: true,
          },
        ],
      },
    ];
  }

  getModalWidth() {
    return this.props.mainContainer.rightColumn;
  }

  renderChildWidget = (childWidgetData: WidgetProps): ReactNode => {
    childWidgetData.parentId = this.props.widgetId;
    childWidgetData.shouldScrollContents = false;
    childWidgetData.canExtend = false;
    childWidgetData.bottomRow = childWidgetData.bottomRow;
    childWidgetData.isVisible = this.props.isVisible;
    childWidgetData.containerStyle = "none";
    childWidgetData.minHeight = this.props.height;
    childWidgetData.rightColumn = this.getModalWidth();
    return WidgetFactory.createWidget(childWidgetData, this.props.renderMode);
  };

  onModalClose = () => {
    if (this.props.onClose) {
      super.executeAction({
        triggerPropertyName: "onClose",
        dynamicString: this.props.onClose,
        event: {
          type: EventType.ON_MODAL_CLOSE,
        },
      });
    }
  };

  closeModal = () => {
    this.props.showPropertyPane(undefined);
    this.props.updateWidgetMetaProperty("isVisible", false);
  };

  getChildren(): ReactNode {
    if (this.props.children && this.props.children.length > 0) {
      const children = this.props.children.filter(Boolean);
      return children.length > 0 && children.map(this.renderChildWidget);
    }
  }

  makeModalComponent(content: ReactNode) {
    return (
      <ModalComponent
        canOutsideClickClose={!!this.props.canOutsideClickClose}
        className={`t--modal-widget ${generateClassName(this.props.widgetId)}`}
        height={this.props.height}
        rounded={this.props.rounded}
        isOpen={!!this.props.isVisible}
        onClose={this.closeModal}
        onModalClose={this.onModalClose}
      >
        {content}
      </ModalComponent>
    );
  }

  getCanvasView() {
    let children = this.getChildren();
    children = this.showWidgetName(children, true);
    return this.makeModalComponent(children);
  }

  getPageView() {
    const children = this.getChildren();
    return this.makeModalComponent(children);
  }

  getWidgetType() {
    return WidgetTypes.TARO_POPUP_WIDGET;
  }
}

export interface MPopupWidgetProps extends WidgetProps, WithMeta {
  renderMode: RenderMode;
  children?: WidgetProps[];
  canOutsideClickClose?: boolean;
  rounded?: boolean;
  height?: number;
  showPropertyPane: (widgetId?: string) => void;
  onClose: string;
  mainContainer: WidgetProps;
}

const mapDispatchToProps = (dispatch: any) => ({
  showPropertyPane: (
    widgetId?: string,
    callForDragOrResize?: boolean,
    force = false,
  ) => {
    dispatch({
      type:
        widgetId || callForDragOrResize
          ? ReduxActionTypes.SHOW_PROPERTY_PANE
          : ReduxActionTypes.HIDE_PROPERTY_PANE,
      payload: { widgetId, callForDragOrResize, force },
    });
  },
});

const mapStateToProps = (state: AppState) => {
  const props = {
    mainContainer: getWidget(state, MAIN_CONTAINER_WIDGET_ID),
  };
  return props;
};
export default MPopupWidget;
export const MProfiledPopupWidget = connect(
  mapStateToProps,
  mapDispatchToProps,
)(withMeta(MPopupWidget));
