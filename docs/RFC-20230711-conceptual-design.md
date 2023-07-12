# Concepts

- Parallelism should be dynamic and determined by the worker
  - To model partial resource comsumption, the worker can immediate rejoin the worker pool if the task does not demand the entire capacity from the worker
- Worker may reject a task AFTER it accepts it
  - Task should be returned to the queue and wait for the next available worker
- Dispatch algorithm should run efficiently
  - When task pool status changes
  - When worker pool status changes
- Upon dispatch, the matched task and the worker should be removed from the corresponding pools

# Algorithm
  
