/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  fragment MedicationCard on Medication {\n    id\n    name\n    price\n    presentation\n    requiresPrescription\n    stockStatus\n  }\n": typeof types.MedicationCardFragmentDoc,
    "\n  fragment CartFields on Cart {\n    id\n    itemCount\n    subtotal\n    requiresPrescription\n    items {\n      quantity\n      lineTotal\n      medication {\n        id\n        name\n        price\n        presentation\n        requiresPrescription\n        stockAvailable\n      }\n    }\n  }\n": typeof types.CartFieldsFragmentDoc,
    "\n  fragment OrderSummaryFields on Order {\n    id\n    status\n    statusReason\n    total\n    itemCount\n    requiresPrescription\n    placedAt\n    updatedAt\n    projectionVersion\n  }\n": typeof types.OrderSummaryFieldsFragmentDoc,
    "\n  fragment OrderDetailFields on Order {\n    ...OrderSummaryFields\n    items {\n      medicationName\n      presentation\n      quantity\n      unitPrice\n      lineTotal\n      requiresPrescription\n      medication {\n        id\n        stockAvailable\n      }\n    }\n    prescription {\n      doctorName\n      doctorLicense\n      prescriptionCode\n      issuedAt\n      status\n      notes\n    }\n    patient {\n      id\n      fullName\n    }\n  }\n": typeof types.OrderDetailFieldsFragmentDoc,
    "\n  fragment DomainErrorFields on DomainError {\n    __typename\n    code\n    message\n    ... on OutOfStockError {\n      requested\n      available\n      medication {\n        id\n        name\n      }\n    }\n    ... on PrescriptionRequiredError {\n      medications {\n        id\n        name\n      }\n    }\n    ... on ValidationError {\n      field\n    }\n    ... on InvalidStateTransitionError {\n      from\n      to\n    }\n  }\n": typeof types.DomainErrorFieldsFragmentDoc,
    "\n  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {\n    medications(filter: $filter, sort: $sort, first: $first, after: $after) {\n      totalCount\n      edges {\n        cursor\n        node {\n          ...MedicationCard\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.CatalogDocument,
    "\n  query Categories {\n    therapeuticCategories {\n      id\n      name\n      medicationCount\n    }\n  }\n": typeof types.CategoriesDocument,
    "\n  query MedicationDetail($id: ID!) {\n    medication(id: $id) {\n      ...MedicationCard\n      sku\n      dosage\n      indications\n      stockAvailable\n      updatedAt\n      activeIngredient {\n        id\n        name\n      }\n      laboratory {\n        id\n        name\n      }\n      category {\n        id\n        name\n        medications {\n          ...MedicationCard\n        }\n      }\n    }\n  }\n": typeof types.MedicationDetailDocument,
    "\n  query Me {\n    me {\n      id\n      fullName\n      email\n      role\n    }\n  }\n": typeof types.MeDocument,
    "\n  query MyCart {\n    myCart {\n      ...CartFields\n    }\n  }\n": typeof types.MyCartDocument,
    "\n  query MyOrders {\n    myOrders {\n      ...OrderSummaryFields\n    }\n  }\n": typeof types.MyOrdersDocument,
    "\n  query OrderDetail($id: ID!) {\n    order(id: $id) {\n      ...OrderDetailFields\n    }\n  }\n": typeof types.OrderDetailDocument,
    "\n  query PharmacyQueue {\n    pharmacyQueue {\n      ...OrderDetailFields\n    }\n  }\n": typeof types.PharmacyQueueDocument,
    "\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      token\n      user {\n        id\n        fullName\n        email\n        role\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.LoginDocument,
    "\n  mutation RegisterPatient($input: RegisterPatientInput!) {\n    registerPatient(input: $input) {\n      token\n      user {\n        id\n        fullName\n        email\n        role\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.RegisterPatientDocument,
    "\n  mutation AddItemToCart($input: AddItemToCartInput!) {\n    addItemToCart(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.AddItemToCartDocument,
    "\n  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {\n    updateCartItemQuantity(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.UpdateCartItemQuantityDocument,
    "\n  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {\n    removeItemFromCart(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.RemoveItemFromCartDocument,
    "\n  mutation CheckoutCart($input: CheckoutCartInput!) {\n    checkoutCart(input: $input) {\n      receipt {\n        orderId\n        status\n        total\n        itemCount\n        requiresPrescription\n        acceptedAt\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.CheckoutCartDocument,
    "\n  mutation ApproveOrder($input: ApproveOrderInput!) {\n    approveOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.ApproveOrderDocument,
    "\n  mutation RejectOrder($input: RejectOrderInput!) {\n    rejectOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.RejectOrderDocument,
    "\n  mutation DispatchOrder($input: DispatchOrderInput!) {\n    dispatchOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.DispatchOrderDocument,
    "\n  mutation CancelOrder($input: CancelOrderInput!) {\n    cancelOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": typeof types.CancelOrderDocument,
    "\n  subscription OrderStatusChanged($orderId: ID) {\n    orderStatusChanged(orderId: $orderId) {\n      ...OrderDetailFields\n    }\n  }\n": typeof types.OrderStatusChangedDocument,
    "\n  subscription StockChanged {\n    stockChanged {\n      id\n      stockAvailable\n      stockStatus\n    }\n  }\n": typeof types.StockChangedDocument,
};
const documents: Documents = {
    "\n  fragment MedicationCard on Medication {\n    id\n    name\n    price\n    presentation\n    requiresPrescription\n    stockStatus\n  }\n": types.MedicationCardFragmentDoc,
    "\n  fragment CartFields on Cart {\n    id\n    itemCount\n    subtotal\n    requiresPrescription\n    items {\n      quantity\n      lineTotal\n      medication {\n        id\n        name\n        price\n        presentation\n        requiresPrescription\n        stockAvailable\n      }\n    }\n  }\n": types.CartFieldsFragmentDoc,
    "\n  fragment OrderSummaryFields on Order {\n    id\n    status\n    statusReason\n    total\n    itemCount\n    requiresPrescription\n    placedAt\n    updatedAt\n    projectionVersion\n  }\n": types.OrderSummaryFieldsFragmentDoc,
    "\n  fragment OrderDetailFields on Order {\n    ...OrderSummaryFields\n    items {\n      medicationName\n      presentation\n      quantity\n      unitPrice\n      lineTotal\n      requiresPrescription\n      medication {\n        id\n        stockAvailable\n      }\n    }\n    prescription {\n      doctorName\n      doctorLicense\n      prescriptionCode\n      issuedAt\n      status\n      notes\n    }\n    patient {\n      id\n      fullName\n    }\n  }\n": types.OrderDetailFieldsFragmentDoc,
    "\n  fragment DomainErrorFields on DomainError {\n    __typename\n    code\n    message\n    ... on OutOfStockError {\n      requested\n      available\n      medication {\n        id\n        name\n      }\n    }\n    ... on PrescriptionRequiredError {\n      medications {\n        id\n        name\n      }\n    }\n    ... on ValidationError {\n      field\n    }\n    ... on InvalidStateTransitionError {\n      from\n      to\n    }\n  }\n": types.DomainErrorFieldsFragmentDoc,
    "\n  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {\n    medications(filter: $filter, sort: $sort, first: $first, after: $after) {\n      totalCount\n      edges {\n        cursor\n        node {\n          ...MedicationCard\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.CatalogDocument,
    "\n  query Categories {\n    therapeuticCategories {\n      id\n      name\n      medicationCount\n    }\n  }\n": types.CategoriesDocument,
    "\n  query MedicationDetail($id: ID!) {\n    medication(id: $id) {\n      ...MedicationCard\n      sku\n      dosage\n      indications\n      stockAvailable\n      updatedAt\n      activeIngredient {\n        id\n        name\n      }\n      laboratory {\n        id\n        name\n      }\n      category {\n        id\n        name\n        medications {\n          ...MedicationCard\n        }\n      }\n    }\n  }\n": types.MedicationDetailDocument,
    "\n  query Me {\n    me {\n      id\n      fullName\n      email\n      role\n    }\n  }\n": types.MeDocument,
    "\n  query MyCart {\n    myCart {\n      ...CartFields\n    }\n  }\n": types.MyCartDocument,
    "\n  query MyOrders {\n    myOrders {\n      ...OrderSummaryFields\n    }\n  }\n": types.MyOrdersDocument,
    "\n  query OrderDetail($id: ID!) {\n    order(id: $id) {\n      ...OrderDetailFields\n    }\n  }\n": types.OrderDetailDocument,
    "\n  query PharmacyQueue {\n    pharmacyQueue {\n      ...OrderDetailFields\n    }\n  }\n": types.PharmacyQueueDocument,
    "\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      token\n      user {\n        id\n        fullName\n        email\n        role\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.LoginDocument,
    "\n  mutation RegisterPatient($input: RegisterPatientInput!) {\n    registerPatient(input: $input) {\n      token\n      user {\n        id\n        fullName\n        email\n        role\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.RegisterPatientDocument,
    "\n  mutation AddItemToCart($input: AddItemToCartInput!) {\n    addItemToCart(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.AddItemToCartDocument,
    "\n  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {\n    updateCartItemQuantity(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.UpdateCartItemQuantityDocument,
    "\n  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {\n    removeItemFromCart(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.RemoveItemFromCartDocument,
    "\n  mutation CheckoutCart($input: CheckoutCartInput!) {\n    checkoutCart(input: $input) {\n      receipt {\n        orderId\n        status\n        total\n        itemCount\n        requiresPrescription\n        acceptedAt\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.CheckoutCartDocument,
    "\n  mutation ApproveOrder($input: ApproveOrderInput!) {\n    approveOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.ApproveOrderDocument,
    "\n  mutation RejectOrder($input: RejectOrderInput!) {\n    rejectOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.RejectOrderDocument,
    "\n  mutation DispatchOrder($input: DispatchOrderInput!) {\n    dispatchOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.DispatchOrderDocument,
    "\n  mutation CancelOrder($input: CancelOrderInput!) {\n    cancelOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n": types.CancelOrderDocument,
    "\n  subscription OrderStatusChanged($orderId: ID) {\n    orderStatusChanged(orderId: $orderId) {\n      ...OrderDetailFields\n    }\n  }\n": types.OrderStatusChangedDocument,
    "\n  subscription StockChanged {\n    stockChanged {\n      id\n      stockAvailable\n      stockStatus\n    }\n  }\n": types.StockChangedDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment MedicationCard on Medication {\n    id\n    name\n    price\n    presentation\n    requiresPrescription\n    stockStatus\n  }\n"): (typeof documents)["\n  fragment MedicationCard on Medication {\n    id\n    name\n    price\n    presentation\n    requiresPrescription\n    stockStatus\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment CartFields on Cart {\n    id\n    itemCount\n    subtotal\n    requiresPrescription\n    items {\n      quantity\n      lineTotal\n      medication {\n        id\n        name\n        price\n        presentation\n        requiresPrescription\n        stockAvailable\n      }\n    }\n  }\n"): (typeof documents)["\n  fragment CartFields on Cart {\n    id\n    itemCount\n    subtotal\n    requiresPrescription\n    items {\n      quantity\n      lineTotal\n      medication {\n        id\n        name\n        price\n        presentation\n        requiresPrescription\n        stockAvailable\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment OrderSummaryFields on Order {\n    id\n    status\n    statusReason\n    total\n    itemCount\n    requiresPrescription\n    placedAt\n    updatedAt\n    projectionVersion\n  }\n"): (typeof documents)["\n  fragment OrderSummaryFields on Order {\n    id\n    status\n    statusReason\n    total\n    itemCount\n    requiresPrescription\n    placedAt\n    updatedAt\n    projectionVersion\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment OrderDetailFields on Order {\n    ...OrderSummaryFields\n    items {\n      medicationName\n      presentation\n      quantity\n      unitPrice\n      lineTotal\n      requiresPrescription\n      medication {\n        id\n        stockAvailable\n      }\n    }\n    prescription {\n      doctorName\n      doctorLicense\n      prescriptionCode\n      issuedAt\n      status\n      notes\n    }\n    patient {\n      id\n      fullName\n    }\n  }\n"): (typeof documents)["\n  fragment OrderDetailFields on Order {\n    ...OrderSummaryFields\n    items {\n      medicationName\n      presentation\n      quantity\n      unitPrice\n      lineTotal\n      requiresPrescription\n      medication {\n        id\n        stockAvailable\n      }\n    }\n    prescription {\n      doctorName\n      doctorLicense\n      prescriptionCode\n      issuedAt\n      status\n      notes\n    }\n    patient {\n      id\n      fullName\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment DomainErrorFields on DomainError {\n    __typename\n    code\n    message\n    ... on OutOfStockError {\n      requested\n      available\n      medication {\n        id\n        name\n      }\n    }\n    ... on PrescriptionRequiredError {\n      medications {\n        id\n        name\n      }\n    }\n    ... on ValidationError {\n      field\n    }\n    ... on InvalidStateTransitionError {\n      from\n      to\n    }\n  }\n"): (typeof documents)["\n  fragment DomainErrorFields on DomainError {\n    __typename\n    code\n    message\n    ... on OutOfStockError {\n      requested\n      available\n      medication {\n        id\n        name\n      }\n    }\n    ... on PrescriptionRequiredError {\n      medications {\n        id\n        name\n      }\n    }\n    ... on ValidationError {\n      field\n    }\n    ... on InvalidStateTransitionError {\n      from\n      to\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {\n    medications(filter: $filter, sort: $sort, first: $first, after: $after) {\n      totalCount\n      edges {\n        cursor\n        node {\n          ...MedicationCard\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): (typeof documents)["\n  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {\n    medications(filter: $filter, sort: $sort, first: $first, after: $after) {\n      totalCount\n      edges {\n        cursor\n        node {\n          ...MedicationCard\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Categories {\n    therapeuticCategories {\n      id\n      name\n      medicationCount\n    }\n  }\n"): (typeof documents)["\n  query Categories {\n    therapeuticCategories {\n      id\n      name\n      medicationCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MedicationDetail($id: ID!) {\n    medication(id: $id) {\n      ...MedicationCard\n      sku\n      dosage\n      indications\n      stockAvailable\n      updatedAt\n      activeIngredient {\n        id\n        name\n      }\n      laboratory {\n        id\n        name\n      }\n      category {\n        id\n        name\n        medications {\n          ...MedicationCard\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query MedicationDetail($id: ID!) {\n    medication(id: $id) {\n      ...MedicationCard\n      sku\n      dosage\n      indications\n      stockAvailable\n      updatedAt\n      activeIngredient {\n        id\n        name\n      }\n      laboratory {\n        id\n        name\n      }\n      category {\n        id\n        name\n        medications {\n          ...MedicationCard\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Me {\n    me {\n      id\n      fullName\n      email\n      role\n    }\n  }\n"): (typeof documents)["\n  query Me {\n    me {\n      id\n      fullName\n      email\n      role\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyCart {\n    myCart {\n      ...CartFields\n    }\n  }\n"): (typeof documents)["\n  query MyCart {\n    myCart {\n      ...CartFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyOrders {\n    myOrders {\n      ...OrderSummaryFields\n    }\n  }\n"): (typeof documents)["\n  query MyOrders {\n    myOrders {\n      ...OrderSummaryFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query OrderDetail($id: ID!) {\n    order(id: $id) {\n      ...OrderDetailFields\n    }\n  }\n"): (typeof documents)["\n  query OrderDetail($id: ID!) {\n    order(id: $id) {\n      ...OrderDetailFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PharmacyQueue {\n    pharmacyQueue {\n      ...OrderDetailFields\n    }\n  }\n"): (typeof documents)["\n  query PharmacyQueue {\n    pharmacyQueue {\n      ...OrderDetailFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      token\n      user {\n        id\n        fullName\n        email\n        role\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      token\n      user {\n        id\n        fullName\n        email\n        role\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RegisterPatient($input: RegisterPatientInput!) {\n    registerPatient(input: $input) {\n      token\n      user {\n        id\n        fullName\n        email\n        role\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation RegisterPatient($input: RegisterPatientInput!) {\n    registerPatient(input: $input) {\n      token\n      user {\n        id\n        fullName\n        email\n        role\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddItemToCart($input: AddItemToCartInput!) {\n    addItemToCart(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation AddItemToCart($input: AddItemToCartInput!) {\n    addItemToCart(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {\n    updateCartItemQuantity(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {\n    updateCartItemQuantity(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {\n    removeItemFromCart(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {\n    removeItemFromCart(input: $input) {\n      cart {\n        ...CartFields\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CheckoutCart($input: CheckoutCartInput!) {\n    checkoutCart(input: $input) {\n      receipt {\n        orderId\n        status\n        total\n        itemCount\n        requiresPrescription\n        acceptedAt\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CheckoutCart($input: CheckoutCartInput!) {\n    checkoutCart(input: $input) {\n      receipt {\n        orderId\n        status\n        total\n        itemCount\n        requiresPrescription\n        acceptedAt\n      }\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ApproveOrder($input: ApproveOrderInput!) {\n    approveOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation ApproveOrder($input: ApproveOrderInput!) {\n    approveOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RejectOrder($input: RejectOrderInput!) {\n    rejectOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation RejectOrder($input: RejectOrderInput!) {\n    rejectOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DispatchOrder($input: DispatchOrderInput!) {\n    dispatchOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation DispatchOrder($input: DispatchOrderInput!) {\n    dispatchOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CancelOrder($input: CancelOrderInput!) {\n    cancelOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CancelOrder($input: CancelOrderInput!) {\n    cancelOrder(input: $input) {\n      orderId\n      status\n      aggregateVersion\n      errors {\n        ...DomainErrorFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription OrderStatusChanged($orderId: ID) {\n    orderStatusChanged(orderId: $orderId) {\n      ...OrderDetailFields\n    }\n  }\n"): (typeof documents)["\n  subscription OrderStatusChanged($orderId: ID) {\n    orderStatusChanged(orderId: $orderId) {\n      ...OrderDetailFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription StockChanged {\n    stockChanged {\n      id\n      stockAvailable\n      stockStatus\n    }\n  }\n"): (typeof documents)["\n  subscription StockChanged {\n    stockChanged {\n      id\n      stockAvailable\n      stockStatus\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;