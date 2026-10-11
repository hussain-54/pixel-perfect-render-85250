/**

 * Admission Officer screen to mock/DB operation map for cutover planning.

 * UI remains on mock server fns until wired explicitly — no silent DB fallback.

 */



export type AoCapability = {

  screen: string;

  route: string;

  actions: {

    action: string;

    mockPath: string;

    dbFn: string;

    status: "mock-only" | "db-helper-ready" | "needs-wiring";

  }[];

};



export const AO_DATA_READINESS: AoCapability[] = [

  {

    screen: "Dashboard",

    route: "/staff/dashboard",

    actions: [

      {

        action: "Load KPIs",

        mockPath: "portalGetOfficerDashboard",

        dbFn: "officerDashboardCounts",

        status: "db-helper-ready",

      },

    ],

  },

  {

    screen: "Students",

    route: "/staff/students",

    actions: [

      {

        action: "Directory / filters",

        mockPath: "portalGetStudentsDirectory",

        dbFn: "listStudentsDirectory",

        status: "db-helper-ready",

      },

      {

        action: "Register student",

        mockPath: "portalRegisterStudent",

        dbFn: "createStudentRecord",

        status: "db-helper-ready",

      },

      {

        action: "Assign consultant",

        mockPath: "in-memory student.consultantId",

        dbFn: "assignConsultant",

        status: "db-helper-ready",

      },

      {

        action: "Archive",

        mockPath: "student.archived flag",

        dbFn: "archiveStudent",

        status: "db-helper-ready",

      },

    ],

  },

  {

    screen: "Student profile",

    route: "/staff/students/$studentId",

    actions: [

      {

        action: "Load profile workspace",

        mockPath: "portalGetStudentProfile + student-workspace",

        dbFn: "getStudentById + getAcademicProfile + listAssessments",

        status: "db-helper-ready",

      },

      {

        action: "Save assessment / notes",

        mockPath: "portalSaveStudentAssessment / portalAddStudentNote",

        dbFn: "createAssessment / createInternalNote",

        status: "db-helper-ready",

      },

    ],

  },

  {

    screen: "Applications",

    route: "/staff/applications",

    actions: [

      {

        action: "Pipeline table/board",

        mockPath: "portalGetApplicationsPipeline",

        dbFn: "listApplications",

        status: "db-helper-ready",

      },

      {

        action: "Change stage",

        mockPath: "portalChangeApplicationStage + application-history",

        dbFn: "updateApplicationStage + listApplicationStageHistory",

        status: "db-helper-ready",

      },

    ],

  },

  {

    screen: "Documents",

    route: "/staff/documents",

    actions: [

      {

        action: "Queue / inspect / review",

        mockPath: "portal-documents + document-reviews",

        dbFn: "listStudentDocuments / createDocumentReview / registerDocumentVersion",

        status: "db-helper-ready",

      },

      {

        action: "Private preview",

        mockPath: "local blob store + optional Storage",

        dbFn: "Storage RLS + document_versions.storage_path (enrichDocumentsWithVersions)",

        status: "db-helper-ready",

      },

    ],

  },

  {

    screen: "Offers and Visa",

    route: "/staff/offers",

    actions: [

      {

        action: "Offers / conditions / deposits / CAS-I20 / visa",

        mockPath: "portal-offers + offers-visa.ts",

        dbFn: "listOffers / createOffer / markOfferConditionMet / updateOfferStatus / updateDepositStatus / updateCasI20Status / updateVisaMilestone",

        status: "db-helper-ready",

      },

    ],

  },

  {

    screen: "Tasks",

    route: "/staff/tasks",

    actions: [

      {

        action: "List / upsert / complete",

        mockPath: "portal-tasks",

        dbFn: "listVisibleTasksDb / createTask / updateTask",

        status: "db-helper-ready",

      },

    ],

  },

  {

    screen: "Reports",

    route: "/staff/reports",

    actions: [

      {

        action: "Funnel / turnaround exports",

        mockPath: "portal-reports computed from mock",

        dbFn: "buildPayloadFromDb (listAppsForStudents / listDocsForStudents / listOffersForStudents / listVisaMilestonesForStudents / listDocumentReviewRowsForDocuments)",

        status: "db-helper-ready",

      },

    ],

  },

  {

    screen: "Activity",

    route: "/staff/activity",

    actions: [

      {

        action: "Audit log / export",

        mockPath: "immutable-audit.ts",

        dbFn: "listScopedAuditEvents / buildActivityLogFromDb / writeAudit",

        status: "db-helper-ready",

      },

    ],

  },

];



export function aoCapabilitiesNeedingWiring() {

  return AO_DATA_READINESS.flatMap((s) =>

    s.actions

      .filter((a) => a.status !== "db-helper-ready")

      .map((a) => ({ screen: s.screen, ...a })),

  );

}

