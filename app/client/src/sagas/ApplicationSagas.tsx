import {
  ApplicationPayload,
  ReduxAction,
  ReduxActionErrorTypes,
  ReduxActionTypes,
} from "constants/ReduxActionConstants";
import ApplicationApi, {
  ApplicationObject,
  ApplicationPagePayload,
  ChangeAppViewAccessRequest,
  CreateApplicationRequest,
  CreateApplicationResponse,
  DeleteApplicationRequest,
  DuplicateApplicationRequest,
  FetchUsersApplicationsOrgsResponse,
  ForkApplicationRequest,
  OrganizationApplicationObject,
  PublishApplicationRequest,
  PublishApplicationResponse,
  SetDefaultPageRequest,
  UpdateApplicationRequest,
  ImportApplicationRequest,
  FetchApplicationResponse,
} from "api/ApplicationApi";
import PageApi from "api/PageApi";
import { all, call, put, select, takeLatest } from "redux-saga/effects";

import { validateResponse } from "./ErrorSagas";
import { getUserApplicationsOrgsList } from "selectors/applicationSelectors";
import { ApiResponse } from "api/ApiResponses";
import history from "utils/history";
import {
  BUILDER_PAGE_URL,
  getApplicationViewerPageURL,
  getGenerateTemplateURL,
} from "constants/routes";
import { AppState } from "reducers";
import {
  FetchApplicationPayload,
  setDefaultApplicationPageSuccess,
  resetCurrentApplication,
  FetchApplicationPreviewPayload,
} from "actions/applicationActions";
import { fetchUnreadCommentThreadsCountSuccess } from "actions/commentActions";
import AnalyticsUtil from "utils/AnalyticsUtil";
import {
  APPLICATION_NAME_UPDATE,
  createMessage,
  DELETING_APPLICATION,
  DUPLICATING_APPLICATION,
} from "constants/messages";
import { Toaster } from "components/ads/Toast";
import { APP_MODE } from "entities/App";
import { Organization } from "constants/orgConstants";
import { Variant } from "components/ads/common";
import { AppIconName } from "components/ads/AppIcon";
import { AppColorCode } from "constants/DefaultTheme";
import {
  getCurrentApplicationId,
  getCurrentPageId,
} from "selectors/editorSelectors";
import { showCompletionDialog } from "./OnboardingSagas";

import { deleteRecentAppEntities } from "utils/storage";
import { reconnectWebsocket as reconnectWebsocketAction } from "actions/websocketActions";
import { getCurrentOrg } from "selectors/organizationSelectors";
import { Org } from "constants/orgConstants";
import { AppLayoutConfig } from "reducers/entityReducers/pageListReducer";

const getDefaultPageId = (
  pages?: ApplicationPagePayload[],
): string | undefined => {
  let defaultPage: ApplicationPagePayload | undefined = undefined;
  if (pages) {
    defaultPage = pages.find((page) => page.isDefault);
    if (!defaultPage) {
      defaultPage = pages[0];
    }
  }
  return defaultPage ? defaultPage.id : undefined;
};

let windowReference: Window | null = null;

export function* publishApplicationSaga(
  requestAction: ReduxAction<PublishApplicationRequest>,
) {
  try {
    const request = requestAction.payload;
    const response: PublishApplicationResponse = yield call(
      ApplicationApi.publishApplication,
      request,
    );
    const isValidResponse = yield validateResponse(response);
    if (isValidResponse) {
      yield put({
        type: ReduxActionTypes.PUBLISH_APPLICATION_SUCCESS,
      });

      const applicationId = yield select(getCurrentApplicationId);
      const currentPageId = yield select(getCurrentPageId);

      let appicationViewPageUrl = getApplicationViewerPageURL(
        applicationId,
        currentPageId,
      );

      const showOnboardingCompletionDialog = yield select(showCompletionDialog);
      if (showOnboardingCompletionDialog) {
        appicationViewPageUrl += "?onboardingComplete=true";
      }

      // If the tab is opened focus and reload else open in new tab
      if (!windowReference || windowReference.closed) {
        windowReference = window.open(appicationViewPageUrl, "_blank");
      } else {
        windowReference.focus();
        windowReference.location.href =
          windowReference.location.origin + appicationViewPageUrl;
      }
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.PUBLISH_APPLICATION_ERROR,
      payload: {
        error,
      },
    });
  }
}
export function* getAllApplicationSaga() {
  try {
    const response: FetchUsersApplicationsOrgsResponse = yield call(
      ApplicationApi.getAllApplication,
    );
    const isValidResponse = yield validateResponse(response);
    if (isValidResponse) {
      const organizationApplication: OrganizationApplicationObject[] = response.data.organizationApplications.map(
        (userOrgs: OrganizationApplicationObject) => ({
          organization: userOrgs.organization,
          userRoles: userOrgs.userRoles,
          applications: !userOrgs.applications
            ? []
            : userOrgs.applications.map((application: ApplicationObject) => {
                return {
                  ...application,
                  defaultPageId: getDefaultPageId(application.pages),
                };
              }),
        }),
      );

      yield put({
        type: ReduxActionTypes.FETCH_USER_APPLICATIONS_ORGS_SUCCESS,
        payload: organizationApplication,
      });
      const { newReleasesCount, releaseItems } = response.data || {};
      yield put({
        type: ReduxActionTypes.FETCH_RELEASES_SUCCESS,
        payload: { newReleasesCount, releaseItems },
      });
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.FETCH_USER_APPLICATIONS_ORGS_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* fetchApplicationSaga(
  action: ReduxAction<FetchApplicationPayload>,
) {
  try {
    const { applicationId, mode } = action.payload;
    // Get endpoint based on app mode
    const apiEndpoint =
      mode === APP_MODE.EDIT
        ? ApplicationApi.fetchApplication
        : ApplicationApi.fetchApplicationForViewMode;

    const response: FetchApplicationResponse = yield call(
      apiEndpoint,
      applicationId,
    );

    yield put({
      type: ReduxActionTypes.FETCH_APPLICATION_SUCCESS,
      payload: response.data,
    });

    yield put(
      fetchUnreadCommentThreadsCountSuccess(response.data.unreadCommentThreads),
    );
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.FETCH_APPLICATION_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* setDefaultApplicationPageSaga(
  action: ReduxAction<SetDefaultPageRequest>,
) {
  try {
    const defaultPageId = yield select(
      (state: AppState) => state.entities.pageList.defaultPageId,
    );
    if (defaultPageId !== action.payload.id) {
      const request: SetDefaultPageRequest = action.payload;
      const response: ApiResponse = yield call(
        ApplicationApi.setDefaultApplicationPage,
        request,
      );
      const isValidResponse = yield validateResponse(response);
      if (isValidResponse) {
        yield put(
          setDefaultApplicationPageSuccess(request.id, request.applicationId),
        );
      }
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.SET_DEFAULT_APPLICATION_PAGE_ERROR,
      payload: {
        error,
      },
    });
  }
}

function* updateApplicationLayoutSaga(
  action: ReduxAction<UpdateApplicationRequest>,
) {
  try {
    yield call(updateApplicationSaga, action);
    yield put({
      type: ReduxActionTypes.CURRENT_APPLICATION_LAYOUT_UPDATE,
      payload: action.payload.appLayout,
    });
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.UPDATE_APP_LAYOUT_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* updateApplicationSaga(
  action: ReduxAction<UpdateApplicationRequest>,
) {
  try {
    const request: UpdateApplicationRequest = action.payload;
    const response: ApiResponse = yield call(
      ApplicationApi.updateApplication,
      request,
    );
    const isValidResponse: boolean = yield validateResponse(response);
    // as the redux store updates the app only on success.
    // we have to run this
    if (isValidResponse && request) {
      yield put({
        type: ReduxActionTypes.UPDATE_APPLICATION_SUCCESS,
        payload: action.payload,
      });
    }
    if (isValidResponse && request && request.name) {
      Toaster.show({
        text: createMessage(APPLICATION_NAME_UPDATE),
        variant: Variant.success,
      });
    }
    if (isValidResponse && request.currentApp) {
      yield put({
        type: ReduxActionTypes.CURRENT_APPLICATION_NAME_UPDATE,
        payload: request.name,
      });
    }
    if (isValidResponse && request.viewerLayout) {
      yield put({
        type: ReduxActionTypes.CURRENT_APPLICATION_VIEWER_LAYOUT_UPDATE,
        payload: request.viewerLayout,
      });
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.UPDATE_APPLICATION_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* deleteApplicationSaga(
  action: ReduxAction<DeleteApplicationRequest>,
) {
  try {
    Toaster.show({
      text: createMessage(DELETING_APPLICATION),
    });
    const request: DeleteApplicationRequest = action.payload;
    const response: ApiResponse = yield call(
      ApplicationApi.deleteApplication,
      request,
    );
    const isValidResponse = yield validateResponse(response);
    if (isValidResponse) {
      yield put({
        type: ReduxActionTypes.DELETE_APPLICATION_SUCCESS,
        payload: response.data,
      });
      yield call(deleteRecentAppEntities, request.applicationId);
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.DELETE_APPLICATION_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* duplicateApplicationSaga(
  action: ReduxAction<DeleteApplicationRequest>,
) {
  try {
    Toaster.show({
      text: createMessage(DUPLICATING_APPLICATION),
    });
    const request: DuplicateApplicationRequest = action.payload;
    const response: ApiResponse = yield call(
      ApplicationApi.duplicateApplication,
      request,
    );
    const isValidResponse = yield validateResponse(response);
    if (isValidResponse) {
      const application: ApplicationPayload = {
        ...response.data,
        defaultPageId: getDefaultPageId(response.data.pages),
      };
      yield put({
        type: ReduxActionTypes.DUPLICATE_APPLICATION_SUCCESS,
        payload: response.data,
      });
      const pageURL = BUILDER_PAGE_URL(
        application.id,
        application.defaultPageId,
      );
      history.push(pageURL);
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.DUPLICATE_APPLICATION_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* changeAppViewAccessSaga(
  requestAction: ReduxAction<ChangeAppViewAccessRequest>,
) {
  try {
    const request = requestAction.payload;
    const response: ApiResponse = yield call(
      ApplicationApi.changeAppViewAccess,
      request,
    );
    const isValidResponse = yield validateResponse(response);
    if (isValidResponse) {
      yield put({
        type: ReduxActionTypes.CHANGE_APPVIEW_ACCESS_SUCCESS,
        payload: {
          id: response.data.id,
          isPublic: response.data.isPublic,
        },
      });
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.CHANGE_APPVIEW_ACCESS_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* createApplicationSaga(
  action: ReduxAction<{
    applicationName: string;
    icon: AppIconName;
    color: AppColorCode;
    isMobile: boolean;
    orgId: string;
    resolve: any;
    reject: any;
  }>,
) {
  const {
    applicationName,
    color,
    icon,
    orgId,
    reject,
    isMobile,
  } = action.payload;
  try {
    const userOrgs = yield select(getUserApplicationsOrgsList);
    const existingOrgs = userOrgs.filter(
      (org: Organization) => org.organization.id === orgId,
    )[0];
    const existingApplication = existingOrgs
      ? existingOrgs.applications.find(
          (application: ApplicationPayload) =>
            application.name === applicationName,
        )
      : null;
    if (existingApplication) {
      yield call(reject, {
        _error: "应用名称被占用",
      });
      yield put({
        type: ReduxActionErrorTypes.CREATE_APPLICATION_ERROR,
        payload: {
          error: "应用创建失败",
          show: false,
        },
      });
    } else {
      yield put(resetCurrentApplication());

      const layout: AppLayoutConfig = {
        type: isMobile ? "MOBILE_FLUID" : "DESKTOP",
      };
      const request: CreateApplicationRequest = {
        name: applicationName,
        icon: icon,
        color: color,
        orgId,
        unpublishedAppLayout: layout,
        publishedAppLayout: layout,
      };
      const response: CreateApplicationResponse = yield call(
        ApplicationApi.createApplication,
        request,
      );
      const isValidResponse = yield validateResponse(response);
      if (isValidResponse) {
        const application: ApplicationPayload = {
          ...response.data,
          defaultPageId: getDefaultPageId(response.data.pages),
        };
        AnalyticsUtil.logEvent("CREATE_APP", {
          appName: application.name,
          isMobile,
        });
        // This sets ui.pageWidgets = {} to ensure that
        // widgets are cleaned up from state before
        // finishing creating a new application
        yield put({
          type: ReduxActionTypes.RESET_APPLICATION_WIDGET_STATE_REQUEST,
        });
        yield put({
          type: ReduxActionTypes.CREATE_APPLICATION_SUCCESS,
          payload: {
            orgId,
            application,
          },
        });
        const pageURL = getGenerateTemplateURL(
          application.id,
          application.defaultPageId,
          isMobile,
        );
        history.push(pageURL);

        // subscribe to newly created application
        // users join rooms on connection, so reconnecting
        // ensures user receives the updates in the app just created
        yield put(reconnectWebsocketAction());
      }
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.CREATE_APPLICATION_ERROR,
      payload: {
        error,
        show: false,
        orgId,
      },
    });
  }
}

export function* forkApplicationSaga(
  action: ReduxAction<ForkApplicationRequest>,
) {
  try {
    const response: ApiResponse = yield call(
      ApplicationApi.forkApplication,
      action.payload,
    );
    const isValidResponse = yield validateResponse(response);
    if (isValidResponse) {
      yield put(resetCurrentApplication());
      const application: ApplicationPayload = {
        ...response.data,
        defaultPageId: getDefaultPageId(response.data.pages),
      };
      yield put({
        type: ReduxActionTypes.FORK_APPLICATION_SUCCESS,
        payload: {
          orgId: action.payload.organizationId,
          application,
        },
      });
      const pageURL = BUILDER_PAGE_URL(
        application.id,
        application.defaultPageId,
      );
      history.push(pageURL);
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.FORK_APPLICATION_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* importApplicationSaga(
  action: ReduxAction<ImportApplicationRequest>,
) {
  try {
    const response: ApiResponse = yield call(
      ApplicationApi.importApplicationToOrg,
      action.payload,
    );
    const isValidResponse = yield validateResponse(response);
    if (isValidResponse) {
      const allOrgs = yield select(getCurrentOrg);
      const currentOrg = allOrgs.filter(
        (el: Org) => el.id === action.payload.orgId,
      );
      if (currentOrg.length > 0) {
        const {
          id: appId,
          pages,
        }: {
          id: string;
          pages: { default?: boolean; id: string; isDefault?: boolean }[];
        } = response.data;
        yield put({
          type: ReduxActionTypes.IMPORT_APPLICATION_SUCCESS,
          payload: {
            importedApplication: appId,
          },
        });
        const defaultPage = pages.filter((eachPage) => !!eachPage.isDefault);
        const pageURL = BUILDER_PAGE_URL(appId, defaultPage[0].id);
        history.push(pageURL);
        Toaster.show({
          text: "应用导入成功！",
          variant: Variant.success,
        });
      }
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.IMPORT_APPLICATION_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* fetchApplicationPreviewWxaCodeSaga(
  action: ReduxAction<FetchApplicationPreviewPayload>,
) {
  try {
    const { applicationId } = action.payload;
    const response: ApiResponse = yield call(PageApi.getPreviewWxaCode, {
      app_id: applicationId,
    });
    yield put({
      type: ReduxActionTypes.FETCH_APPLICATION_PREVIEW_SUCCESS,
      payload: {
        data: response.data,
        failed: !response.responseMeta.success,
      },
    });
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.FETCH_APPLICATION_PREVIEW_ERROR,
      payload: {
        error,
      },
    });
  }
}

export default function* applicationSagas() {
  yield all([
    takeLatest(
      ReduxActionTypes.PUBLISH_APPLICATION_INIT,
      publishApplicationSaga,
    ),
    takeLatest(ReduxActionTypes.UPDATE_APP_LAYOUT, updateApplicationLayoutSaga),
    takeLatest(ReduxActionTypes.UPDATE_APPLICATION, updateApplicationSaga),
    takeLatest(
      ReduxActionTypes.CHANGE_APPVIEW_ACCESS_INIT,
      changeAppViewAccessSaga,
    ),
    takeLatest(
      ReduxActionTypes.GET_ALL_APPLICATION_INIT,
      getAllApplicationSaga,
    ),
    takeLatest(ReduxActionTypes.FETCH_APPLICATION_INIT, fetchApplicationSaga),
    takeLatest(ReduxActionTypes.FORK_APPLICATION_INIT, forkApplicationSaga),
    takeLatest(ReduxActionTypes.CREATE_APPLICATION_INIT, createApplicationSaga),
    takeLatest(
      ReduxActionTypes.SET_DEFAULT_APPLICATION_PAGE_INIT,
      setDefaultApplicationPageSaga,
    ),
    takeLatest(ReduxActionTypes.DELETE_APPLICATION_INIT, deleteApplicationSaga),
    takeLatest(
      ReduxActionTypes.DUPLICATE_APPLICATION_INIT,
      duplicateApplicationSaga,
    ),
    takeLatest(ReduxActionTypes.IMPORT_APPLICATION_INIT, importApplicationSaga),
    takeLatest(
      ReduxActionTypes.FETCH_APPLICATION_PREVIEW_INIT,
      fetchApplicationPreviewWxaCodeSaga,
    ),
  ]);
}
