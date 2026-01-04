import { Injectable } from '@nestjs/common';

/**
 * Base abstract class for third-party integrations
 * All third-party providers extend this class and implement the required methods
 *
 * Methods can optionally accept organizationId for tenant-specific AI provider selection
 */
export abstract class ThirdPartyAbstract<T = any> {
  /**
   * Check if the API key is valid
   * @param apiKey - The API key to validate
   * @returns User info if valid, false otherwise
   */
  abstract checkConnection(
    apiKey: string
  ): Promise<false | { name: string; username: string; id: string }>;

  /**
   * Send data to the third-party service for processing
   * @param apiKey - The API key for authentication
   * @param data - Data to send
   * @param organizationId - Optional organization ID for tenant-specific configuration
   * @returns Processed result URL
   */
  abstract sendData(
    apiKey: string,
    data: T,
    organizationId?: string
  ): Promise<string>;

  /**
   * Dynamic function index for additional provider methods
   * Functions may accept optional organizationId as third parameter
   */
  [key: string]: ((apiKey: string, data?: any, organizationId?: string) => Promise<any>) | undefined;
}

export interface ThirdPartyParams {
  identifier: string;
  title: string;
  description: string;
  position: 'media' | 'webhook';
  fields: {
    name: string;
    description: string;
    type: string;
    placeholder: string;
    validation?: RegExp;
  }[];
}

export function ThirdParty(params: ThirdPartyParams) {
  return function (target: any) {
    // Apply @Injectable decorator to the target class
    Injectable()(target);

    // Retrieve existing metadata or initialize an empty array
    const existingMetadata =
      Reflect.getMetadata('third:party', ThirdPartyAbstract) || [];

    // Add the metadata information for this method
    existingMetadata.push({ target, ...params });

    // Define metadata on the class prototype (so it can be retrieved from the class)
    Reflect.defineMetadata('third:party', existingMetadata, ThirdPartyAbstract);
  };
}
