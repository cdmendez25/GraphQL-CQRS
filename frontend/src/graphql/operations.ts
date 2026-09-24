import { graphql } from '../gql';

/*
 * Todas las operaciones que el frontend envía a /graphql.
 * Cada pantalla pide SOLO los campos que muestra (sin over-fetching):
 * el catálogo usa el fragmento condensado MedicationCard y la ficha técnica
 * pide además laboratorio, principio activo, indicaciones, etc.
 */

// ─── Fragmentos ───────────────────────────────────────────────────────

graphql(`
  fragment MedicationCard on Medication {
    id
    name
    price
    presentation
    requiresPrescription
    stockStatus
  }
`);

graphql(`
  fragment CartFields on Cart {
    id
    itemCount
    subtotal
    requiresPrescription
    items {
      quantity
      lineTotal
      medication {
        id
        name
        price
        presentation
        requiresPrescription
        stockAvailable
      }
    }
  }
`);

graphql(`
  fragment OrderSummaryFields on Order {
    id
    status
    statusReason
    total
    itemCount
    requiresPrescription
    placedAt
    updatedAt
    projectionVersion
  }
`);

graphql(`
  fragment OrderDetailFields on Order {
    ...OrderSummaryFields
    items {
      medicationName
      presentation
      quantity
      unitPrice
      lineTotal
      requiresPrescription
      medication {
        id
        stockAvailable
      }
    }
    prescription {
      doctorName
      doctorLicense
      prescriptionCode
      issuedAt
      status
      notes
    }
    patient {
      id
      fullName
    }
  }
`);

graphql(`
  fragment DomainErrorFields on DomainError {
    __typename
    code
    message
    ... on OutOfStockError {
      requested
      available
      medication {
        id
        name
      }
    }
    ... on PrescriptionRequiredError {
      medications {
        id
        name
      }
    }
    ... on ValidationError {
      field
    }
    ... on InvalidStateTransitionError {
      from
      to
    }
  }
`);

// ─── Queries (read model) ─────────────────────────────────────────────

export const CATALOG_QUERY = graphql(`
  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {
    medications(filter: $filter, sort: $sort, first: $first, after: $after) {
      totalCount
      edges {
        cursor
        node {
          ...MedicationCard
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const CATEGORIES_QUERY = graphql(`
  query Categories {
    therapeuticCategories {
      id
      name
      medicationCount
    }
  }
`);

export const MEDICATION_DETAIL_QUERY = graphql(`
  query MedicationDetail($id: ID!) {
    medication(id: $id) {
      ...MedicationCard
      sku
      dosage
      indications
      stockAvailable
      updatedAt
      activeIngredient {
        id
        name
      }
      laboratory {
        id
        name
      }
      category {
        id
        name
        medications {
          ...MedicationCard
        }
      }
    }
  }
`);

export const ME_QUERY = graphql(`
  query Me {
    me {
      id
      fullName
      email
      role
    }
  }
`);

export const MY_CART_QUERY = graphql(`
  query MyCart {
    myCart {
      ...CartFields
    }
  }
`);

export const MY_ORDERS_QUERY = graphql(`
  query MyOrders {
    myOrders {
      ...OrderSummaryFields
    }
  }
`);

export const ORDER_QUERY = graphql(`
  query OrderDetail($id: ID!) {
    order(id: $id) {
      ...OrderDetailFields
    }
  }
`);

export const PHARMACY_QUEUE_QUERY = graphql(`
  query PharmacyQueue {
    pharmacyQueue {
      ...OrderDetailFields
    }
  }
`);

// ─── Mutations (comandos) ─────────────────────────────────────────────

export const LOGIN_MUTATION = graphql(`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        fullName
        email
        role
      }
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

export const REGISTER_MUTATION = graphql(`
  mutation RegisterPatient($input: RegisterPatientInput!) {
    registerPatient(input: $input) {
      token
      user {
        id
        fullName
        email
        role
      }
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

export const ADD_TO_CART_MUTATION = graphql(`
  mutation AddItemToCart($input: AddItemToCartInput!) {
    addItemToCart(input: $input) {
      cart {
        ...CartFields
      }
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

export const UPDATE_CART_ITEM_MUTATION = graphql(`
  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {
    updateCartItemQuantity(input: $input) {
      cart {
        ...CartFields
      }
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

export const REMOVE_CART_ITEM_MUTATION = graphql(`
  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {
    removeItemFromCart(input: $input) {
      cart {
        ...CartFields
      }
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

export const CHECKOUT_MUTATION = graphql(`
  mutation CheckoutCart($input: CheckoutCartInput!) {
    checkoutCart(input: $input) {
      receipt {
        orderId
        status
        total
        itemCount
        requiresPrescription
        acceptedAt
      }
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

export const APPROVE_ORDER_MUTATION = graphql(`
  mutation ApproveOrder($input: ApproveOrderInput!) {
    approveOrder(input: $input) {
      orderId
      status
      aggregateVersion
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

export const REJECT_ORDER_MUTATION = graphql(`
  mutation RejectOrder($input: RejectOrderInput!) {
    rejectOrder(input: $input) {
      orderId
      status
      aggregateVersion
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

export const DISPATCH_ORDER_MUTATION = graphql(`
  mutation DispatchOrder($input: DispatchOrderInput!) {
    dispatchOrder(input: $input) {
      orderId
      status
      aggregateVersion
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

export const CANCEL_ORDER_MUTATION = graphql(`
  mutation CancelOrder($input: CancelOrderInput!) {
    cancelOrder(input: $input) {
      orderId
      status
      aggregateVersion
      errors {
        ...DomainErrorFields
      }
    }
  }
`);

// ─── Subscriptions (tiempo real) ──────────────────────────────────────

export const ORDER_STATUS_SUBSCRIPTION = graphql(`
  subscription OrderStatusChanged($orderId: ID) {
    orderStatusChanged(orderId: $orderId) {
      ...OrderDetailFields
    }
  }
`);

export const STOCK_SUBSCRIPTION = graphql(`
  subscription StockChanged {
    stockChanged {
      id
      stockAvailable
      stockStatus
    }
  }
`);
