export interface IHerokuConfiguration {
    mappings: IHerokuMapping[];
    connection: {
        app_name: string;
        organization_id: string;
        exported_at: string;
        features: {
            poll_db_no_merge: boolean;
            poll_external_ids: boolean;
            rest_count_only: boolean;
        };
    };
    version: number;
}

export interface IHerokuMapping {
    object_name: string;
    config: {
        access: string;
        sf_notify_enabled: boolean;
        sf_polling_seconds: number;
        sf_max_daily_api_calls: number;
        fields: object;
        indexes: object;
    };
}
